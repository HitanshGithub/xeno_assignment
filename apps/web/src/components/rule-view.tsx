import {
  FIELD_BY_KEY,
  formatMoney,
  isGroup,
  type Condition,
  type FieldKey,
  type Operator,
  type RuleGroup,
} from '@cadence/shared';

/** Read-only chips for a segment rule tree — the "auditable audience" made visible. */
export function RuleView({ group }: { group: RuleGroup }) {
  return <Group group={group} top />;
}

function Group({ group, top }: { group: RuleGroup; top?: boolean }) {
  const joiner = group.combinator === 'AND' ? 'and' : 'or';
  return (
    <div
      className={
        top ? 'flex flex-wrap items-center gap-2' : 'inline-flex flex-wrap items-center gap-2'
      }
    >
      {group.conditions.map((node, i) => (
        <span key={i} className="inline-flex items-center gap-2">
          {i > 0 && (
            <span className="text-ink-faint text-xs font-semibold uppercase">{joiner}</span>
          )}
          {isGroup(node) ? (
            <span className="border-border-strong inline-flex items-center gap-1 rounded-lg border px-1.5 py-1">
              <Group group={node} />
            </span>
          ) : (
            <ConditionChip condition={node} />
          )}
        </span>
      ))}
    </div>
  );
}

const OP_SYMBOL: Record<Operator, string> = {
  eq: 'is',
  neq: 'is not',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  between: '',
  in: '∈',
  contains: '·',
  exists: 'exists',
};

function ConditionChip({ condition }: { condition: Condition }) {
  const def = FIELD_BY_KEY[condition.field as FieldKey];
  const label = def?.label ?? condition.field;
  return (
    <span className="border-brand/25 bg-brand-soft/50 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className="text-brand font-medium">{valueText(condition)}</span>
    </span>
  );
}

function valueText(c: Condition): string {
  const def = FIELD_BY_KEY[c.field as FieldKey];
  if (c.field === 'marketingOptIn') return c.value ? 'opted in' : 'opted out';
  if (c.op === 'between' && Array.isArray(c.value)) {
    return `${scalar(c.field, c.value[0]!)} – ${scalar(c.field, c.value[1]!)}`;
  }
  const v = Array.isArray(c.value)
    ? c.value.map((x) => scalar(c.field, x)).join(', ')
    : scalar(c.field, c.value);
  return `${OP_SYMBOL[c.op]} ${v}`.trim();
}

function scalar(field: FieldKey, value: string | number | boolean): string {
  const def = FIELD_BY_KEY[field];
  if (def?.type === 'currency' && typeof value === 'number')
    return formatMoney(value, 'INR', { decimals: false });
  if (def?.type === 'duration') return `${value}d`;
  return String(value);
}
