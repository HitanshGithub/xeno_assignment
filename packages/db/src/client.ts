import { PrismaClient } from '@prisma/client';

/**
 * A single shared PrismaClient.
 *
 * Next.js hot-reloads modules in dev, which would otherwise spin up a new
 * client (and a new connection pool) on every change until the database
 * refuses connections. Stashing the instance on `globalThis` keeps exactly one
 * around across reloads. In production a fresh module graph means a fresh
 * client, which is what we want.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
