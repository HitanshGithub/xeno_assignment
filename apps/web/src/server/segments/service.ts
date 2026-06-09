import { prisma, type Prisma, type Segment, type SegmentSource } from '@cadence/db';
import { segmentDefinitionSchema, type SegmentDefinition } from '@cadence/shared';
import { countSegment } from './evaluate';

/**
 * Segment persistence. Every write validates the rule tree against the shared
 * schema before it touches the DB, and caches the audience size so list views
 * don't re-evaluate on every render.
 */

export interface SegmentInput {
  name: string;
  description?: string;
  source?: SegmentSource;
  prompt?: string;
  definition: SegmentDefinition;
}

function parseDefinition(value: Prisma.JsonValue): SegmentDefinition {
  return segmentDefinitionSchema.parse(value);
}

export async function createSegment(input: SegmentInput): Promise<Segment> {
  const definition = segmentDefinitionSchema.parse(input.definition);
  const cachedCount = await countSegment(definition);
  return prisma.segment.create({
    data: {
      name: input.name,
      description: input.description,
      source: input.source ?? 'MANUAL',
      prompt: input.prompt,
      definition: definition as unknown as Prisma.InputJsonValue,
      cachedCount,
      cachedAt: new Date(),
    },
  });
}

export function listSegments(): Promise<Segment[]> {
  return prisma.segment.findMany({ orderBy: { createdAt: 'desc' } });
}

export function getSegment(id: string): Promise<Segment | null> {
  return prisma.segment.findUnique({ where: { id } });
}

export async function updateSegment(id: string, patch: Partial<SegmentInput>): Promise<Segment> {
  const data: Prisma.SegmentUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.description !== undefined) data.description = patch.description;
  if (patch.definition !== undefined) {
    const definition = segmentDefinitionSchema.parse(patch.definition);
    data.definition = definition as unknown as Prisma.InputJsonValue;
    data.cachedCount = await countSegment(definition);
    data.cachedAt = new Date();
  }
  return prisma.segment.update({ where: { id }, data });
}

export function deleteSegment(id: string): Promise<Segment> {
  return prisma.segment.delete({ where: { id } });
}

/** Recompute and persist the cached audience size for a stored segment. */
export async function refreshSegmentCount(id: string): Promise<number> {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id } });
  const count = await countSegment(parseDefinition(segment.definition));
  await prisma.segment.update({
    where: { id },
    data: { cachedCount: count, cachedAt: new Date() },
  });
  return count;
}
