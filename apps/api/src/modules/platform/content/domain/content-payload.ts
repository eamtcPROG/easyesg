import { findInternalIdentifiers } from '@easyesg/i18n';
import { DISCLOSURES, type Disclosure } from '@easyesg/vsme';

/**
 * Reading one field of a stored content payload (task 76; `architecture.md` §12.5.6's task-76 row (3)). Each reader
 * answers the value or why the store refuses it, so the read path and the publication rule are one function's two
 * faces — what the store admits is exactly what the reader reads.
 */
export type FieldRead<T> = { readonly value: T } | { readonly fault: string };

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** The fault of a part that is not an object at all — a topic, an article, a locale's block, a section. */
export const NOT_AN_OBJECT = 'is not an object';

/** The facade's disclosures grouped as the standard groups them, typed as what each group holds. */
const DISCLOSURE_GROUPS: readonly Readonly<Record<string, Disclosure>>[] = Object.values(DISCLOSURES);

/**
 * The registered taxonomy's element keys and axes, as `findInternalIdentifiers`' declared terms — UC-181 names *a
 * taxonomy element key* among what no article may carry, and no shape can tell `EnergyConsumptionFromFuels` from a
 * word. **Only the ones shaped like an identifier**, a lowercase letter followed by a capital: the detector matches a
 * term case-insensitively, and a one-word key such as `Turnover` would refuse every English article that says
 * *turnover*. The facade carries the version `@easyesg/vsme` generates, which is where its element keys are spelled.
 */
const ELEMENT_TERMS: readonly string[] = [
  ...new Set(
    DISCLOSURE_GROUPS.flatMap((group) => Object.values(group))
      .flatMap((disclosure) => (disclosure.axis === null ? [disclosure.key] : [disclosure.key, disclosure.axis])),
  ),
].filter((term) => /[a-z][A-Z]/u.test(term));

/**
 * An HTML tag's opening — `<` before a letter, `/` or `!`. `apps/web` renders an article's Markdown with raw HTML off
 * (task 77), so a tag would reach the reader as literal text; refused where it can be corrected. `< 50` is not one.
 */
const HTML_TAG = /<[a-z!/]/iu;

/**
 * Text a person reads — a title, a summary, a section's body — trimmed, or why it may not be published: blank, an
 * internal identifier (the root `CLAUDE.md`'s user-facing-text rule, UC-181), or an HTML tag.
 */
export const readText = (value: unknown): FieldRead<string> => {
  if (typeof value !== 'string' || value.trim() === '') return { fault: 'is blank' };
  const [identifier] = findInternalIdentifiers(value, ELEMENT_TERMS);
  if (identifier !== undefined) return { fault: `carries ${identifier.rule}, "${identifier.match}"` };
  if (HTML_TAG.test(value)) return { fault: 'carries an HTML tag' };
  return { value: value.trim() };
};

/** A list of texts, each read as `readText` reads one; empty is a list. */
export const readTexts = (value: unknown): FieldRead<string[]> => {
  if (!Array.isArray(value)) return { fault: 'is not a list' };
  const texts: string[] = [];
  for (const [index, entry] of value.entries()) {
    const text = readText(entry);
    if ('fault' in text) return { fault: `entry ${index + 1} ${text.fault}` };
    texts.push(text.value);
  }
  return { value: texts };
};

/** Another item's key — a topic an article belongs to, an article it names — read as a key, not as prose. */
export const readKey = (value: unknown): FieldRead<string> =>
  typeof value === 'string' && value.trim() !== '' ? { value: value.trim() } : { fault: 'is not a key' };

/** Where an item sits among its kind: a whole number of at least zero, ties broken by key. */
export const readOrder = (value: unknown): FieldRead<number> =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? { value }
    : { fault: 'is not a whole number of at least zero' };
