/** Small RNG helpers. The simulator is intentionally non-deterministic — real
 *  channels are — so this wraps Math.random rather than a seeded generator. */

export const rand = () => Math.random();

export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

export const chance = (p: number) => Math.random() < p;

export const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

export const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Short random id with a prefix, e.g. randomId('ch') -> 'ch_k3f9a1b2'. */
export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}
