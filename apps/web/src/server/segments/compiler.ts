import { Prisma } from '@cadence/db';
import {
  isGroup,
  type Condition,
  type FieldKey,
  type Operator,
  type RuleGroup,
  type SegmentDefinition,
} from '@cadence/shared';

/**
 * Compiles a segment rule tree into a Prisma `CustomerWhereInput`.
 *
 * Why compile to Prisma's where-input and not raw SQL: it is parameterised by
 * construction (no injection surface from model-or-user-authored trees), it
 * composes with `count` / `findMany` / pagination for free, and the derived
 * fields (recency/tenure as day-deltas, category affinity as a relation
 * EXISTS) translate cleanly. The trade is that a few operators (notably `neq`
 * on a derived duration) compile to a `NOT { … }` wrapper rather than a single
 * comparator — handled explicitly below.
 */

const DAY = 24 * 60 * 60 * 1000;

type Where = Prisma.CustomerWhereInput;

export function compileSegment(definition: SegmentDefinition, now: Date = new Date()): Where {
  return compileGroup(definition, now);
}

function compileGroup(group: RuleGroup, now: Date): Where {
  const compiled = group.conditions.map((node) =>
    isGroup(node) ? compileGroup(node, now) : compileCondition(node, now),
  );
  return group.combinator === 'AND' ? { AND: compiled } : { OR: compiled };
}

function compileCondition(cond: Condition, now: Date): Where {
  switch (cond.field) {
    case 'lifetimeValueCents':
    case 'orderCount':
    case 'avgOrderValueCents':
      return { [cond.field]: numericComparator(cond.op, cond.value) };

    case 'daysSinceLastOrder':
      return durationCondition('lastOrderAt', cond.op, cond.value, now);
    case 'daysSinceFirstOrder':
      return durationCondition('firstOrderAt', cond.op, cond.value, now);
    case 'daysSinceSignup':
      return durationCondition('signedUpAt', cond.op, cond.value, now);

    case 'city':
      return { city: stringComparator(cond.op, cond.value) };

    case 'marketingOptIn':
      return { marketingOptIn: Boolean(cond.value) };

    case 'tags':
      // `contains` → array membership.
      return { tags: { has: String(cond.value) } };

    case 'purchasedCategory':
      // `contains` → has at least one order line in this category.
      return { orders: { some: { items: { some: { category: String(cond.value) } } } } };

    default:
      return assertNever(cond.field);
  }
}

// --- comparators -----------------------------------------------------------

function numericComparator(op: Operator, value: Condition['value']): Prisma.IntFilter {
  switch (op) {
    case 'eq':
      return { equals: num(value) };
    case 'neq':
      return { not: num(value) };
    case 'gt':
      return { gt: num(value) };
    case 'gte':
      return { gte: num(value) };
    case 'lt':
      return { lt: num(value) };
    case 'lte':
      return { lte: num(value) };
    case 'between': {
      const [lo, hi] = numPair(value);
      return { gte: lo, lte: hi };
    }
    default:
      throw new Error(`operator ${op} is not valid for a numeric field`);
  }
}

function stringComparator(op: Operator, value: Condition['value']): Prisma.StringFilter {
  switch (op) {
    case 'eq':
      return { equals: String(value) };
    case 'neq':
      return { not: String(value) };
    case 'in':
      return { in: arr(value).map(String) };
    default:
      throw new Error(`operator ${op} is not valid for a string field`);
  }
}

/**
 * Maps a day-delta condition onto its underlying timestamp column. Larger
 * "days since" = older = an *earlier* timestamp, so the comparison flips.
 */
function durationCondition(
  column: 'lastOrderAt' | 'firstOrderAt' | 'signedUpAt',
  op: Operator,
  value: Condition['value'],
  now: Date,
): Where {
  const cutoff = (days: number) => new Date(now.getTime() - days * DAY);

  switch (op) {
    case 'gt': // more than N days ago → before cutoff(N)
      return { [column]: { lt: cutoff(num(value)) } };
    case 'gte':
      return { [column]: { lte: cutoff(num(value)) } };
    case 'lt': // fewer than N days ago → after cutoff(N)
      return { [column]: { gt: cutoff(num(value)) } };
    case 'lte':
      return { [column]: { gte: cutoff(num(value)) } };
    case 'eq': {
      const n = num(value);
      return { [column]: { gte: cutoff(n + 1), lt: cutoff(n) } };
    }
    case 'neq': {
      const n = num(value);
      return { NOT: { [column]: { gte: cutoff(n + 1), lt: cutoff(n) } } };
    }
    case 'between': {
      const [lo, hi] = numPair(value); // lo..hi days ago
      return { [column]: { gte: cutoff(hi), lte: cutoff(lo) } };
    }
    default:
      throw new Error(`operator ${op} is not valid for a duration field`);
  }
}

// --- value narrowing -------------------------------------------------------

function num(value: Condition['value']): number {
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) throw new Error(`expected a number, got ${JSON.stringify(value)}`);
  return parsed;
}

function numPair(value: Condition['value']): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`expected a [min, max] pair, got ${JSON.stringify(value)}`);
  }
  return [num(value[0]!), num(value[1]!)];
}

function arr(value: Condition['value']): Array<string | number> {
  if (!Array.isArray(value)) throw new Error(`expected an array, got ${JSON.stringify(value)}`);
  return value;
}

function assertNever(field: FieldKey): never {
  throw new Error(`unhandled field: ${field}`);
}
