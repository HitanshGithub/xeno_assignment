/**
 * The segmentable field catalogue — the single source of truth shared by:
 *   - the AI (this catalogue is injected into the prompt so the model can only
 *     emit fields/operators that actually exist),
 *   - the UI rule builder (renders inputs from `type` + `options`),
 *   - the SQL compiler in the CRM (maps each `FieldKey` to a column/expression).
 *
 * Keeping it in one place is what makes the natural-language → audience step
 * trustworthy: the model cannot invent a field, and what it produces is exactly
 * what the builder shows and the compiler runs.
 */

export const OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
  'contains',
  'exists',
] as const;
export type Operator = (typeof OPERATORS)[number];

export type FieldType =
  | 'currency' // integer minor units
  | 'count'
  | 'duration' // whole days
  | 'string'
  | 'boolean'
  | 'enum'
  | 'tags' // string[] membership
  | 'category'; // membership over purchased product categories

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  description: string;
  operators: Operator[];
  unit?: string;
  options?: string[];
}

const NUMERIC_OPS: Operator[] = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'];

export const FIELDS = [
  {
    key: 'lifetimeValueCents',
    label: 'Lifetime spend',
    type: 'currency',
    description: 'Total amount the customer has ever spent, in minor units (paise).',
    operators: NUMERIC_OPS,
    unit: 'INR paise',
  },
  {
    key: 'orderCount',
    label: 'Order count',
    type: 'count',
    description: 'Number of orders the customer has placed.',
    operators: NUMERIC_OPS,
  },
  {
    key: 'avgOrderValueCents',
    label: 'Average order value',
    type: 'currency',
    description: 'Average order value, in minor units (paise).',
    operators: NUMERIC_OPS,
    unit: 'INR paise',
  },
  {
    key: 'daysSinceLastOrder',
    label: 'Days since last order',
    type: 'duration',
    description:
      'Recency. Whole days since the most recent order. Large = lapsing/churned. ' +
      'Customers with no orders are excluded by this field.',
    operators: NUMERIC_OPS,
    unit: 'days',
  },
  {
    key: 'daysSinceFirstOrder',
    label: 'Days since first order',
    type: 'duration',
    description: 'Tenure as a buyer. Whole days since the first order.',
    operators: NUMERIC_OPS,
    unit: 'days',
  },
  {
    key: 'daysSinceSignup',
    label: 'Days since signup',
    type: 'duration',
    description: 'Whole days since the customer first appeared. Small = new.',
    operators: NUMERIC_OPS,
    unit: 'days',
  },
  {
    key: 'city',
    label: 'City',
    type: 'enum',
    description: 'Customer city.',
    operators: ['eq', 'neq', 'in'],
    options: [
      'Mumbai',
      'Bengaluru',
      'Delhi',
      'Pune',
      'Hyderabad',
      'Chennai',
      'Gurugram',
      'Kolkata',
    ],
  },
  {
    key: 'marketingOptIn',
    label: 'Marketing opt-in',
    type: 'boolean',
    description: 'Whether the customer consents to marketing. Sends always exclude opted-out.',
    operators: ['eq'],
  },
  {
    key: 'tags',
    label: 'Tags',
    type: 'tags',
    description: 'Attribute tags on the customer.',
    operators: ['contains'],
    options: ['app-user', 'newsletter', 'vip', 'store-pickup'],
  },
  {
    key: 'purchasedCategory',
    label: 'Purchased category',
    type: 'category',
    description: 'Customer has at least one order containing this product category.',
    operators: ['contains'],
    options: ['Espresso', 'Brewed', 'Cold', 'Food', 'Beans', 'Merch'],
  },
] as const satisfies readonly FieldDef[];

export type FieldKey = (typeof FIELDS)[number]['key'];

export const FIELD_KEYS = FIELDS.map((f) => f.key) as [FieldKey, ...FieldKey[]];

export const FIELD_BY_KEY: Record<FieldKey, FieldDef> = Object.fromEntries(
  FIELDS.map((f) => [f.key, f]),
) as Record<FieldKey, FieldDef>;
