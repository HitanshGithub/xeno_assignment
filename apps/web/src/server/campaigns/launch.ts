import { prisma } from '@cadence/db';
import {
  channelUsesEmail,
  segmentDefinitionSchema,
  type SendMessage,
} from '@cadence/shared';
import { getBrand } from '../brand';
import { sendBatch } from '../channel/client';
import { resolveRecipients, type RecipientRow } from '../segments/evaluate';
import { buildVars, renderTemplate } from './render';
import { computePropensity } from './propensity';

const SEND_CHUNK = 500;

export interface LaunchResult {
  campaignId: string;
  recipients: number;
  accepted: number;
  rejected: number;
}

export class LaunchError extends Error {}

/**
 * Launch a draft campaign end to end:
 *   1. resolve the opted-in, addressable audience for the channel
 *   2. snapshot one Communication per recipient (personalised body + a stable
 *      idempotency key) so editing the campaign later never rewrites history
 *   3. hand the batch(es) to the channel and record provider ids / rejections
 *
 * The whole thing is safe to retry: communications are created with
 * `skipDuplicates` on the idempotency key, and the channel de-dupes sends, so a
 * partial failure followed by a relaunch never double-sends.
 */
export async function launchCampaign(campaignId: string): Promise<LaunchResult> {
  const campaign = await prisma.campaign.findUniqueOrThrow({
    where: { id: campaignId },
    include: { segment: true },
  });

  if (campaign.status !== 'DRAFT') {
    throw new LaunchError(`campaign is ${campaign.status}, only DRAFT can be launched`);
  }
  if (!campaign.segment) {
    throw new LaunchError('campaign has no segment to target');
  }

  const definition = segmentDefinitionSchema.parse(campaign.segment.definition);
  const recipients = await resolveRecipients(definition, campaign.channel);
  if (recipients.length === 0) {
    throw new LaunchError('no opted-in, addressable recipients match this segment');
  }

  const brand = await getBrand();
  const useEmail = channelUsesEmail(campaign.channel);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: 'LAUNCHING', launchedAt: new Date() },
  });

  // 2) Snapshot communications (idempotent on key).
  const commRows = recipients.map((r) => {
    const vars = buildVars(r, brand);
    return {
      campaignId,
      customerId: r.id,
      channel: campaign.channel,
      recipient: (useEmail ? r.email : r.phone)!,
      renderedSubject: campaign.messageSubject
        ? renderTemplate(campaign.messageSubject, vars)
        : null,
      renderedBody: renderTemplate(campaign.messageBody, vars),
      idempotencyKey: `${campaignId}:${r.id}`,
      status: 'QUEUED' as const,
    };
  });
  await prisma.communication.createMany({ data: commRows, skipDuplicates: true });

  // Re-read to get ids, then build the send messages with engagement context.
  const comms = await prisma.communication.findMany({
    where: { campaignId },
    select: {
      id: true,
      customerId: true,
      channel: true,
      recipient: true,
      renderedSubject: true,
      renderedBody: true,
      idempotencyKey: true,
    },
  });
  const propByCustomer = new Map<string, number>(
    recipients.map((r: RecipientRow) => [r.id, computePropensity(r)]),
  );

  const messages: SendMessage[] = comms.map((c) => ({
    communicationId: c.id,
    idempotencyKey: c.idempotencyKey,
    channel: c.channel,
    recipient: c.recipient,
    subject: c.renderedSubject ?? undefined,
    body: c.renderedBody,
    context: { engagementPropensity: propByCustomer.get(c.customerId) ?? 0.5 },
  }));

  // 3) Dispatch in chunks; apply per-message results as each batch returns.
  let accepted = 0;
  let rejected = 0;
  const chunks = chunk(messages, SEND_CHUNK);
  for (let i = 0; i < chunks.length; i++) {
    const response = await sendBatch(`${campaignId}:b${i}`, chunks[i]!);
    accepted += response.accepted;
    rejected += response.rejected;
    await applySendResults(response.results);
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { status: 'RUNNING' } });

  return { campaignId, recipients: recipients.length, accepted, rejected };
}

async function applySendResults(
  results: { communicationId: string; providerMessageId: string | null; status: string; reason?: string }[],
): Promise<void> {
  await Promise.all(
    results.map((r) =>
      r.status === 'REJECTED'
        ? prisma.communication.update({
            where: { id: r.communicationId },
            data: { status: 'FAILED', failureReason: r.reason ?? 'rejected by channel', failedAt: new Date() },
          })
        : prisma.communication.update({
            where: { id: r.communicationId },
            data: { providerMessageId: r.providerMessageId },
          }),
    ),
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
