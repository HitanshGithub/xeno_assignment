import { CHANNEL_META, FIELDS, OPERATORS } from '@cadence/shared';
import { getBrand } from '@/server/brand';
import { resolvedAiProvider } from '@/server/env';
import { ok, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

/**
 * Everything the UI needs to render the segment builder and channel pickers
 * without hard-coding it: the brand, the field catalogue, operators, and
 * per-channel metadata. One source of truth, served once.
 */
export const GET = withErrors(async () => {
  const brand = await getBrand();
  return ok({
    brand: {
      name: brand.name,
      tagline: brand.tagline,
      description: brand.description,
      currency: brand.currency,
    },
    fields: FIELDS,
    operators: OPERATORS,
    channels: Object.values(CHANNEL_META),
    aiProvider: resolvedAiProvider(),
  });
});
