import { prisma } from '@cadence/db';
import { z } from 'zod';
import { recomputeRollups } from './rollups';

/**
 * Data ingestion: take in customers and their orders and store them. Upserts
 * are keyed on the source's stable `externalId` so re-running an import is
 * idempotent. Customer rollups are recomputed once per affected customer after
 * an order batch, not per row.
 */

export const customerImportSchema = z.object({
  externalId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  tags: z.array(z.string()).optional(),
  marketingOptIn: z.boolean().optional(),
  signedUpAt: z.coerce.date().optional(),
});
export type CustomerImport = z.infer<typeof customerImportSchema>;

export const orderItemImportSchema = z.object({
  productName: z.string().min(1),
  category: z.string().min(1),
  sku: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  unitPriceCents: z.number().int().nonnegative(),
});

export const orderImportSchema = z.object({
  externalId: z.string().min(1),
  customerExternalId: z.string().min(1),
  orderedAt: z.coerce.date(),
  totalCents: z.number().int().nonnegative().optional(),
  currency: z.string().optional(),
  items: z.array(orderItemImportSchema).min(1),
});
export type OrderImport = z.infer<typeof orderImportSchema>;

export async function ingestCustomers(
  records: CustomerImport[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  for (const r of records) {
    const existing = await prisma.customer.findUnique({
      where: { externalId: r.externalId },
      select: { id: true },
    });
    await prisma.customer.upsert({
      where: { externalId: r.externalId },
      create: {
        externalId: r.externalId,
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email?.toLowerCase(),
        phone: r.phone,
        city: r.city,
        country: r.country ?? 'IN',
        tags: r.tags ?? [],
        marketingOptIn: r.marketingOptIn ?? true,
        signedUpAt: r.signedUpAt ?? new Date(),
      },
      update: {
        firstName: r.firstName,
        lastName: r.lastName,
        email: r.email?.toLowerCase(),
        phone: r.phone,
        city: r.city,
        ...(r.country ? { country: r.country } : {}),
        ...(r.tags ? { tags: r.tags } : {}),
        ...(r.marketingOptIn !== undefined ? { marketingOptIn: r.marketingOptIn } : {}),
      },
    });
    existing ? updated++ : created++;
  }
  return { created, updated };
}

export async function ingestOrders(
  records: OrderImport[],
): Promise<{ created: number; skipped: number; unknownCustomers: number }> {
  let created = 0;
  let skipped = 0;
  let unknownCustomers = 0;
  const affected = new Set<string>();

  for (const r of records) {
    const customer = await prisma.customer.findUnique({
      where: { externalId: r.customerExternalId },
      select: { id: true },
    });
    if (!customer) {
      unknownCustomers++;
      continue;
    }
    const exists = await prisma.order.findUnique({
      where: { externalId: r.externalId },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    const totalCents =
      r.totalCents ?? r.items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0);

    await prisma.order.create({
      data: {
        externalId: r.externalId,
        customerId: customer.id,
        orderedAt: r.orderedAt,
        totalCents,
        currency: r.currency ?? 'INR',
        channel: 'IMPORT',
        items: { create: r.items },
      },
    });
    affected.add(customer.id);
    created++;
  }

  // One rollup pass per affected customer, regardless of how many orders landed.
  for (const customerId of affected) await recomputeRollups(customerId);

  return { created, skipped, unknownCustomers };
}
