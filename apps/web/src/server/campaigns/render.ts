import type { Brand } from '@cadence/db';
import { TEMPLATE_VARS, type TemplateVar } from '@cadence/shared';

/**
 * Message personalisation. Templates use {{placeholder}} tokens drawn from a
 * small allow-list (defined in @cadence/shared so the AI, the UI, and this
 * renderer all agree). Rendering substitutes per recipient; unknown tokens are
 * stripped so a bad template can never leak a literal `{{secret}}` to a shopper.
 */
const TOKEN = /\{\{\s*(\w+)\s*\}\}/g;

interface RenderSubject {
  firstName: string;
  lastName?: string | null;
  city?: string | null;
}

export function buildVars(customer: RenderSubject, brand: Brand): Record<TemplateVar, string> {
  return {
    firstName: customer.firstName?.trim() || 'there',
    lastName: customer.lastName?.trim() ?? '',
    city: customer.city?.trim() ?? '',
    brandName: brand.name,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template
    .replace(TOKEN, (_match, key: string) => vars[key] ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Placeholders referenced by a template — used to validate AI/marketer drafts. */
export function extractPlaceholders(template: string): string[] {
  const found = new Set<string>();
  for (const m of template.matchAll(TOKEN)) found.add(m[1]!);
  return [...found];
}

/** Any placeholders that aren't in the allow-list (empty = valid). */
export function unknownPlaceholders(template: string): string[] {
  return extractPlaceholders(template).filter((p) => !TEMPLATE_VARS.includes(p as TemplateVar));
}
