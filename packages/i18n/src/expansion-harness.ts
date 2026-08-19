/**
 * The +40% string-expansion harness (UX-94, §15.4 Phase 0 deliverable 7).
 *
 * Wired at Phase 0 and run at the end of every phase, because retrofitting it after twenty
 * screens finds the same class of bug twenty times. Romanian is the source and both English
 * and Russian expand against it; a layout that depends on string length fails here rather
 * than in a translated production build.
 *
 * Switched by an explicit flag rather than inferred from NODE_ENV, so a staging build can turn
 * it on without pretending to be development — and so it can never turn itself on in production
 * because someone mis-set an environment.
 */
export const EXPANSION_FACTOR = 1.4;

/**
 * The flag's name. Read by each app from its own environment surface — `process.env` in
 * `apps/web`, `import.meta.env` in `apps/admin` — because this package is framework-free and
 * has no ambient Node types by design (`"types": []` in its tsconfig).
 */
export const EXPANSION_FLAG = 'EASYESG_PSEUDOLOCALE';

/**
 * Whether a raw flag value means on. Only the exact string `'1'` does.
 *
 * Deliberately not truthiness: `'0'` and `'false'` are both truthy strings, and a harness that
 * pads every label in production because someone wrote `EASYESG_PSEUDOLOCALE=false` is a worse
 * outage than the layout bug it exists to catch.
 */
export function expansionEnabled(flag: string | undefined): boolean {
  return flag === '1';
}

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
