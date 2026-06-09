import { z } from 'zod';
import { FIELD_KEYS, OPERATORS, type FieldKey, type Operator } from './fields';

/**
 * The segment rule tree (AST). A segment is a boolean combination of conditions
 * — an editable, inspectable artefact, not raw SQL. The AI emits this; the UI
 * renders it; the CRM compiles it to a parameterised query.
 *
 * Values are deliberately permissive at the leaf (number | string | boolean |
 * array) with operator/value coherence enforced in `refineCondition`, because
 * that produces far better validation messages than a giant discriminated
 * union and is friendlier to model output.
 */

export const conditionValueSchema = z.union([
  z.number(),
  z.string(),
  z.boolean(),
  z.array(z.union([z.number(), z.string()])).min(1),
]);

export const conditionSchema = z
  .object({
    field: z.enum(FIELD_KEYS),
    op: z.enum(OPERATORS),
    value: conditionValueSchema,
  })
  .superRefine((cond, ctx) => {
    const { op, value } = cond;
    const arrayOps: Operator[] = ['in', 'between'];
    if (op === 'between') {
      if (!Array.isArray(value) || value.length !== 2 || value.some((v) => typeof v !== 'number')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '`between` requires a [min, max] pair of numbers',
        });
      }
    } else if (op === 'in') {
      if (!Array.isArray(value)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`in` requires an array of values' });
      }
    } else if (op === 'exists') {
      if (typeof value !== 'boolean') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`exists` requires a boolean' });
      }
    } else if (!arrayOps.includes(op) && Array.isArray(value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `operator \`${op}\` does not take an array value`,
      });
    }
  });

export type Condition = {
  field: FieldKey;
  op: Operator;
  value: number | string | boolean | Array<number | string>;
};

export type RuleGroup = {
  combinator: 'AND' | 'OR';
  conditions: Array<Condition | RuleGroup>;
};

// Recursive group schema. `z.lazy` ties the knot; the explicit type annotation
// keeps inference honest across the recursion.
export const ruleGroupSchema: z.ZodType<RuleGroup> = z.lazy(() =>
  z.object({
    combinator: z.enum(['AND', 'OR']),
    conditions: z.array(z.union([conditionSchema, ruleGroupSchema])).min(1),
  }),
);

/** A segment definition is a top-level rule group. */
export const segmentDefinitionSchema = ruleGroupSchema;
export type SegmentDefinition = RuleGroup;

export function isGroup(node: Condition | RuleGroup): node is RuleGroup {
  return (node as RuleGroup).combinator !== undefined;
}

/** Count the leaf conditions in a tree — handy for UI summaries and guards. */
export function countConditions(node: Condition | RuleGroup): number {
  if (!isGroup(node)) return 1;
  return node.conditions.reduce((sum, child) => sum + countConditions(child), 0);
}
