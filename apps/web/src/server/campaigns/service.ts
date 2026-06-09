import { prisma, type Campaign, type Channel, type Prisma } from '@cadence/db';

export interface CampaignInput {
  name: string;
  goal?: string;
  channel: Channel;
  segmentId?: string;
  messageSubject?: string;
  messageBody: string;
  aiRationale?: Prisma.InputJsonValue;
}

export function createCampaign(input: CampaignInput): Promise<Campaign> {
  return prisma.campaign.create({
    data: {
      name: input.name,
      goal: input.goal,
      channel: input.channel,
      segmentId: input.segmentId,
      messageSubject: input.messageSubject,
      messageBody: input.messageBody,
      aiRationale: input.aiRationale,
      status: 'DRAFT',
    },
  });
}

export function listCampaigns(): Promise<Campaign[]> {
  return prisma.campaign.findMany({
    orderBy: { createdAt: 'desc' },
    include: { segment: { select: { name: true, cachedCount: true } } },
  });
}

export function getCampaign(id: string) {
  return prisma.campaign.findUnique({ where: { id }, include: { segment: true } });
}

export async function updateCampaign(
  id: string,
  patch: Partial<CampaignInput>,
): Promise<Campaign> {
  const campaign = await prisma.campaign.findUniqueOrThrow({ where: { id } });
  if (campaign.status !== 'DRAFT') {
    throw new Error('only draft campaigns can be edited');
  }
  return prisma.campaign.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.goal !== undefined ? { goal: patch.goal } : {}),
      ...(patch.channel !== undefined ? { channel: patch.channel } : {}),
      ...(patch.segmentId !== undefined ? { segmentId: patch.segmentId } : {}),
      ...(patch.messageSubject !== undefined ? { messageSubject: patch.messageSubject } : {}),
      ...(patch.messageBody !== undefined ? { messageBody: patch.messageBody } : {}),
      ...(patch.aiRationale !== undefined ? { aiRationale: patch.aiRationale } : {}),
    },
  });
}

export function deleteCampaign(id: string): Promise<Campaign> {
  return prisma.campaign.delete({ where: { id } });
}
