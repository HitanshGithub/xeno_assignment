import { z } from 'zod';
import {
  customerImportSchema,
  ingestCustomers,
  ingestOrders,
  orderImportSchema,
} from '@/server/ingestion';
import { ok, readJson, withErrors } from '@/server/http';

export const dynamic = 'force-dynamic';

const schema = z.object({
  customers: z.array(customerImportSchema).optional(),
  orders: z.array(orderImportSchema).optional(),
});

/**
 * Ingest customers and/or orders in one call. Customers are upserted before
 * orders so a combined payload links correctly; both are idempotent on
 * externalId, so re-posting the same file is safe.
 */
export const POST = withErrors(async (req: Request) => {
  const { customers, orders } = await readJson(req, schema);
  const customerResult = customers?.length ? await ingestCustomers(customers) : null;
  const orderResult = orders?.length ? await ingestOrders(orders) : null;
  return ok({ customers: customerResult, orders: orderResult });
});
