import {
  FIELD_BY_KEY,
  formatMoney,
  isGroup,
  type Condition,
  type FieldKey,
  type Operator,
  type RuleGroup,
  type SegmentDefinition,
} from '@cadence/shared';

/**
 * Renders a rule tree as a plain-English phrase — used in the UI ("here's who
 * I think you mean") and echoed back by the AI so a marketer can sanity-check
 * an audience before sending. Transparency, in words.
 */
export function describeSegment(definition: SegmentDefinition): string {
  return describeGroup(definition, true);
}

function describeGroup(group: RuleGroup, top = false): string {
  const joiner = group.combinator === 'AND' ? ' and ' : ' or ';
  const parts = group.conditions.map((node) =>
    isGroup(node) ? `(${describeGroup(node)})` : describeCondition(node),
  );
  const joined = parts.join(joiner);
  return top ? joined : joined;
}

const OP_PHRASE: Record<Operator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: 'over',
  gte: 'at least',
  lt: 'under',
  lte: 'at most',
  between: 'between',
  in: 'is one of',
  contains: 'includes',
  exists: 'exists',
};

function describeCondition(cond: Condition): string {
  const def = FIELD_BY_KEY[cond.field as FieldKey];
  const label = def?.label ?? cond.field;

  // A few fields read far better with bespoke phrasing.
  if (cond.field === 'marketingOptIn') {
    return cond.value ? 'opted in to marketing' : 'opted out of marketing';
  }
  if (cond.field === 'tags') {
    return `tagged “${String(cond.value)}”`;
  }
  if (cond.field === 'purchasedCategory') {
    return `has bought ${String(cond.value)}`;
  }

  const valueText = formatValue(cond);
  if (cond.op === 'between' && Array.isArray(cond.value)) {
    return `${label.toLowerCase()} between ${formatScalar(cond.field, cond.value[0]!)} and ${formatScalar(
      cond.field,
      cond.value[1]!,
    )}`;
  }
  return `${label.toLowerCase()} ${OP_PHRASE[cond.op]} ${valueText}`;
}

function formatValue(cond: Condition): string {
  if (Array.isArray(cond.value))
    return cond.value.map((v) => formatScalar(cond.field, v)).join(', ');
  return formatScalar(cond.field, cond.value);
}

function formatScalar(field: FieldKey, value: string | number | boolean): string {
  const def = FIELD_BY_KEY[field];
  if (!def) return String(value);
  if (def.type === 'currency' && typeof value === 'number') {
    return formatMoney(value, 'INR', { decimals: false });
  }
  if (def.type === 'duration') return `${value} days`;
  if (def.type === 'count') return `${value}`;
  return String(value);
}
