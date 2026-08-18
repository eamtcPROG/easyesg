/**
 * The +40% string-expansion harness (UX-94, §15.4 Phase 0 deliverable 7).
 *
 * Wired at Phase 0 and run at the end of every phase, because retrofitting it after twenty
 * screens finds the same class of bug twenty times. Romanian is the source and both English
 * and Russian expand against it; a layout that depends on string length fails here rather
 * than in a translated production build.
 *
 * Dev-only. `enabled` reads an explicit flag rather than inferring from NODE_ENV so that a
 * staging build can switch it on without pretending to be development.
 */
export const EXPANSION_FACTOR = 1.4;

/** Padding character: visually distinct, single-width, and not a letter in any live locale. */
const PAD = '·';

export function expandString(value: string, factor: number = EXPANSION_FACTOR): string {
  if (!value) return value;
  const target = Math.ceil(value.length * factor);
  return value.length >= target ? value : value + PAD.repeat(target - value.length);
}

/** Recursively expands every leaf string, leaving the catalogue shape untouched. */
export function expandCatalogue<T>(node: T, factor: number = EXPANSION_FACTOR): T {
  if (typeof node === 'string') return expandString(node, factor) as T;
  if (node && typeof node === 'object') {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>).map(([k, v]) => [k, expandCatalogue(v, factor)]),
    ) as T;
  }
  return node;
}
