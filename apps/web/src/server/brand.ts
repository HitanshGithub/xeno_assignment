import { prisma, type Brand } from '@cadence/db';

/** Sensible fallback so the app and the AI work even before the seed runs. */
const FALLBACK: Brand = {
  id: 'fallback',
  name: 'Brew & Bean',
  tagline: 'Your daily ritual, brewed right.',
  description: 'A specialty coffee chain.',
  voice: 'Warm, a little playful, never pushy.',
  website: null,
  currency: 'INR',
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function getBrand(): Promise<Brand> {
  const brand = await prisma.brand.findFirst({ orderBy: { createdAt: 'asc' } });
  return brand ?? FALLBACK;
}
