/**
 * Seed: "Brew & Bean", a fictional Indian specialty-coffee chain.
 *
 * The data is *persona-driven and deterministic* (fixed RNG seed) so that
 * segmentation demos are reproducible and actually interesting: there are
 * loyal regulars, high-value VIPs, lapsed weekly drinkers ripe for win-back,
 * brand-new shoppers, one-and-done buyers, and fully churned customers — each
 * with order histories that match. Money is in integer minor units (paise).
 */
import { PrismaClient, type Prisma } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

// --- Deterministic RNG (mulberry32) so reseeds are identical ---------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);
faker.seed(42);

const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const daysAgo = (d: number) => new Date(now - d * DAY);

// --- Catalogue --------------------------------------------------------------
type Product = { name: string; category: string; sku: string; priceCents: number };
const CATALOGUE: Product[] = [
  { name: 'Signature Latte', category: 'Espresso', sku: 'ESP-LAT', priceCents: 25000 },
  { name: 'Cappuccino', category: 'Espresso', sku: 'ESP-CAP', priceCents: 24000 },
  { name: 'Flat White', category: 'Espresso', sku: 'ESP-FLW', priceCents: 26000 },
  { name: 'Americano', category: 'Brewed', sku: 'BRW-AME', priceCents: 20000 },
  { name: 'Single-Origin Pour Over', category: 'Brewed', sku: 'BRW-POV', priceCents: 28000 },
  { name: 'Cold Brew', category: 'Cold', sku: 'CLD-CBR', priceCents: 28000 },
  { name: 'Iced Caramel Latte', category: 'Cold', sku: 'CLD-ICL', priceCents: 30000 },
  { name: 'Butter Croissant', category: 'Food', sku: 'FOD-CRS', priceCents: 18000 },
  { name: 'Blueberry Muffin', category: 'Food', sku: 'FOD-MUF', priceCents: 16000 },
  { name: 'Chocolate Chip Cookie', category: 'Food', sku: 'FOD-CKE', priceCents: 12000 },
  { name: 'Whole Bean 250g', category: 'Beans', sku: 'BEN-250', priceCents: 65000 },
  { name: 'Cold Brew Bottle 1L', category: 'Beans', sku: 'BEN-CBB', priceCents: 35000 },
  { name: 'Ceramic Mug', category: 'Merch', sku: 'MRC-MUG', priceCents: 45000 },
  { name: 'Insulated Tumbler', category: 'Merch', sku: 'MRC-TMB', priceCents: 89000 },
];
const drinks = CATALOGUE.filter((p) => ['Espresso', 'Brewed', 'Cold'].includes(p.category));
const foods = CATALOGUE.filter((p) => p.category === 'Food');
const beans = CATALOGUE.filter((p) => p.category === 'Beans');
const merch = CATALOGUE.filter((p) => p.category === 'Merch');

const CITIES = [
  'Mumbai',
  'Bengaluru',
  'Delhi',
  'Pune',
  'Hyderabad',
  'Chennai',
  'Gurugram',
  'Kolkata',
];

// --- Personas ---------------------------------------------------------------
// Each persona drives recency (days since last order), frequency (#orders),
// tenure, basket style, and tags — the levers segmentation will slice on.
type Persona = {
  key: string;
  weight: number;
  tenureDays: [number, number];
  lastOrderDaysAgo: [number, number];
  orders: [number, number];
  // Average days between orders for this persona (cadence).
  cadenceDays: [number, number];
  // Probability the basket includes a pastry / beans / merch alongside a drink.
  pastry: number;
  beans: number;
  merch: number;
  tags: string[];
};

const PERSONAS: Persona[] = [
  {
    key: 'loyal-regular',
    weight: 22,
    tenureDays: [180, 900],
    lastOrderDaysAgo: [0, 9],
    orders: [25, 90],
    cadenceDays: [4, 9],
    pastry: 0.55,
    beans: 0.15,
    merch: 0.05,
    tags: ['app-user', 'newsletter'],
  },
  {
    key: 'vip-highvalue',
    weight: 8,
    tenureDays: [300, 1100],
    lastOrderDaysAgo: [0, 14],
    orders: [40, 130],
    cadenceDays: [3, 7],
    pastry: 0.6,
    beans: 0.5,
    merch: 0.35,
    tags: ['app-user', 'newsletter', 'vip'],
  },
  {
    key: 'lapsed-weekly', // the classic win-back target
    weight: 16,
    tenureDays: [240, 900],
    lastOrderDaysAgo: [40, 110],
    orders: [18, 60],
    cadenceDays: [5, 9],
    pastry: 0.5,
    beans: 0.2,
    merch: 0.1,
    tags: ['app-user', 'newsletter'],
  },
  {
    key: 'occasional',
    weight: 20,
    tenureDays: [120, 800],
    lastOrderDaysAgo: [10, 50],
    orders: [4, 14],
    cadenceDays: [18, 45],
    pastry: 0.4,
    beans: 0.1,
    merch: 0.05,
    tags: ['newsletter'],
  },
  {
    key: 'new-shopper',
    weight: 14,
    tenureDays: [1, 30],
    lastOrderDaysAgo: [0, 20],
    orders: [1, 3],
    cadenceDays: [3, 12],
    pastry: 0.45,
    beans: 0.08,
    merch: 0.04,
    tags: ['app-user'],
  },
  {
    key: 'one-and-done',
    weight: 10,
    tenureDays: [90, 700],
    lastOrderDaysAgo: [70, 260],
    orders: [1, 1],
    cadenceDays: [0, 0],
    pastry: 0.3,
    beans: 0.05,
    merch: 0.02,
    tags: [],
  },
  {
    key: 'churned',
    weight: 10,
    tenureDays: [400, 1200],
    lastOrderDaysAgo: [200, 540],
    orders: [6, 40],
    cadenceDays: [7, 20],
    pastry: 0.45,
    beans: 0.2,
    merch: 0.12,
    tags: ['newsletter'],
  },
];

function pickPersona(): Persona {
  const total = PERSONAS.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (const p of PERSONAS) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return PERSONAS[0]!;
}

function buildBasket(persona: Persona): Product[] {
  const basket: Product[] = [];
  const drinkCount = randInt(1, 2);
  for (let i = 0; i < drinkCount; i++) basket.push(pick(drinks));
  if (chance(persona.pastry)) basket.push(pick(foods));
  if (chance(persona.beans)) basket.push(pick(beans));
  if (chance(persona.merch)) basket.push(pick(merch));
  return basket;
}

const TOTAL_CUSTOMERS = 480;

async function main() {
  console.log('🌱  Resetting database…');
  // Child-first deletion to respect FK constraints.
  await prisma.communicationEvent.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.communication.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.segment.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.brand.deleteMany();

  await prisma.brand.create({
    data: {
      name: 'Brew & Bean',
      tagline: 'Your daily ritual, brewed right.',
      description:
        'A specialty coffee chain across urban India — hand-crafted espresso, ' +
        'single-origin pour overs, cold brew on tap, fresh-baked pastries, and ' +
        'whole beans to take home.',
      voice: 'Warm, a little playful, never pushy. Talks to regulars like friends.',
      website: 'https://brewandbean.example',
      currency: 'INR',
    },
  });

  console.log(`👥  Generating ${TOTAL_CUSTOMERS} customers with order histories…`);
  const personaTally: Record<string, number> = {};

  for (let i = 0; i < TOTAL_CUSTOMERS; i++) {
    const persona = pickPersona();
    personaTally[persona.key] = (personaTally[persona.key] ?? 0) + 1;

    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const tenure = randInt(persona.tenureDays[0], persona.tenureDays[1]);
    const lastOrderDays = randInt(persona.lastOrderDaysAgo[0], persona.lastOrderDaysAgo[1]);
    const orderCount = randInt(persona.orders[0], persona.orders[1]);

    // Walk order dates backwards from the most recent order using the persona's
    // cadence, clamped to within the customer's tenure.
    const orderDates: Date[] = [];
    let cursor = lastOrderDays;
    for (let o = 0; o < orderCount; o++) {
      if (cursor > tenure) break;
      orderDates.push(daysAgo(cursor));
      const gap =
        persona.cadenceDays[1] === 0 ? 0 : randInt(persona.cadenceDays[0], persona.cadenceDays[1]);
      cursor += Math.max(1, gap);
    }
    orderDates.reverse(); // oldest → newest

    const tags = [...persona.tags];
    if (chance(0.15) && !tags.includes('store-pickup')) tags.push('store-pickup');

    const customer = await prisma.customer.create({
      data: {
        externalId: `BB-${String(100000 + i)}`,
        firstName,
        lastName,
        email: faker.internet.email({ firstName, lastName, provider: 'example.com' }).toLowerCase(),
        phone: `+9197${randInt(10000000, 99999999)}`,
        city: pick(CITIES),
        country: 'IN',
        tags,
        marketingOptIn: chance(0.9),
        signedUpAt: daysAgo(tenure),
      },
    });

    // Create orders + items and accumulate rollups.
    let lifetime = 0;
    let firstOrderAt: Date | undefined;
    let lastOrderAt: Date | undefined;

    for (let o = 0; o < orderDates.length; o++) {
      const date = orderDates[o]!;
      const basket = buildBasket(persona);
      const items: Prisma.OrderItemCreateWithoutOrderInput[] = basket.map((p) => {
        const quantity = p.category === 'Beans' || p.category === 'Merch' ? 1 : randInt(1, 2);
        return {
          productName: p.name,
          category: p.category,
          sku: p.sku,
          quantity,
          unitPriceCents: p.priceCents,
        };
      });
      const total = items.reduce((s, it) => s + it.unitPriceCents * (it.quantity ?? 1), 0);
      lifetime += total;
      firstOrderAt ??= date;
      lastOrderAt = date;

      await prisma.order.create({
        data: {
          externalId: `BB-O-${customer.externalId}-${o}`,
          customerId: customer.id,
          orderedAt: date,
          totalCents: total,
          currency: 'INR',
          channel: 'SEED',
          items: { create: items },
        },
      });
    }

    const realCount = orderDates.length;
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        orderCount: realCount,
        lifetimeValueCents: lifetime,
        firstOrderAt,
        lastOrderAt,
        avgOrderValueCents: realCount > 0 ? Math.round(lifetime / realCount) : 0,
      },
    });
  }

  const customers = await prisma.customer.count();
  const orders = await prisma.order.count();
  console.log('\n✅  Seed complete.');
  console.log(`    Brand:     Brew & Bean`);
  console.log(`    Customers: ${customers}`);
  console.log(`    Orders:    ${orders}`);
  console.log('    Personas:', personaTally);
}

main()
  .catch((e) => {
    console.error('❌  Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
