import type { MessageCatalogue } from './messages.js';

/**
 * Catalogue integrity checks — the mechanism that replaces FR-64's runtime fallback queue
 * for committed text (architecture.md OQ-43).
 *
 * Every locale is present at build time, so a gap is detectable before release rather than
 * after. That is strictly stronger than a queue: a queue tells you a user already saw the
 * wrong language; this tells you nobody will.
 *
 * It carries more weight than a parity check usually does, because UX-97 prohibits a visible
 * "missing translation" marker and `getMessageFallback` returns an empty string. A missing key
 * is therefore **invisible at runtime by design** — a blank where a label should be, on a page
 * that otherwise looks correct.
 *
 * Lives in `src/` rather than beside the specs because two suites need it — this package's own
 * catalogues and each app's chrome — and a copy in each is how the two drift apart.
 */

/** Every leaf path in a catalogue, dot-joined. `{a:{b:'x'}}` → `['a.b']`. */
export function leafKeys(node: unknown, prefix = ''): string[] {
  if (node === null || typeof node !== 'object') return [prefix];
  return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
    leafKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

export interface ParityResult {
  /** In the source locale, absent here — a translation someone still has to write. */
  readonly missing: readonly string[];
  /**
   * Here, absent from the source locale. Usually a rename applied to one file only — but it is
   * also what a machine translation looks like when it invents a key, which FR-63 forbids.
   */
  readonly unexpected: readonly string[];
}

export function compareToSource(
  source: MessageCatalogue,
  translated: MessageCatalogue,
): ParityResult {
  const sourceKeys = leafKeys(source);
  const translatedKeys = leafKeys(translated);
  return {
    missing: sourceKeys.filter((k) => !translatedKeys.includes(k)).sort(),
    unexpected: translatedKeys.filter((k) => !sourceKeys.includes(k)).sort(),
  };
}

/**
 * Leaf paths whose value is the empty string.
 *
 * An empty value passes a key-set comparison and renders as nothing — the same blank UX-97
 * makes invisible. Placeholder-by-omission is the failure mode this catches.
 */
export function blankKeys(catalogue: MessageCatalogue): string[] {
  return leafKeys(catalogue)
    .filter((key) => key.split('.').reduce<unknown>((n, p) => (n as never)?.[p], catalogue) === '')
    .sort();
}
