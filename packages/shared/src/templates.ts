/**
 * The personalisation placeholders a message template may use. Canonical here
 * because three places must agree on the allow-list: the AI (told what it may
 * emit), the UI (renders the chips), and the renderer (substitutes per
 * recipient and strips anything off-list).
 */
export const TEMPLATE_VARS = ['firstName', 'lastName', 'city', 'brandName'] as const;
export type TemplateVar = (typeof TEMPLATE_VARS)[number];
