/**
 * The modules this release has a plain-language name for — the keys of `organization.wizard.modules` (task 179.1).
 *
 * **The names ship with the release, not the taxonomy** (the owner's choice, 30 Sep 2026): B1 … B11 and C1 … C9 are
 * the standard's own structure rather than a version's elements, so they sit in the browser's catalogue as the
 * derivation inputs' names do (task 36.10), written separately in ro, en and ru from the taxonomy's section titles.
 *
 * **A module the pinned taxonomy carries and this list does not is still a step** — a later version's addition —
 * and shows its reference alone rather than a guessed name; `isNamedModule` is the narrowing that decides which.
 * `messages.parity.spec.ts` keeps the three catalogues' keys equal, and `module-names.spec.ts` keeps them equal to this
 * list, so a name cannot exist in the catalogue without being reachable, or be reachable without existing.
 */
export const NAMED_MODULES = [
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B9',
  'B10',
  'B11',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'C9',
] as const;

export type NamedModule = (typeof NAMED_MODULES)[number];

const NAMED: ReadonlySet<string> = new Set(NAMED_MODULES);

export const isNamedModule = (reference: string): reference is NamedModule => NAMED.has(reference);
