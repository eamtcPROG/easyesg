import { LOCALES, leafKeys } from '@easyesg/i18n';
import { FINDING_MESSAGE_PARTS, type FindingMessagePart } from '@easyesg/validation';
import { COMMITTED_CATALOGUES, isWordedAsFindingInEveryLocale } from './committed-catalogues';

describe('isWordedAsFindingInEveryLocale (task 42; NFR-79)', () => {
  it('answers yes for a message every locale words in its three parts', () => {
    expect(isWordedAsFindingInEveryLocale('validation.required')).toBe(true);
    expect(isWordedAsFindingInEveryLocale('validation.sum.over')).toBe(true);
  });

  it('answers no for a part, which is one sentence of three, and for a namespace of several messages', () => {
    expect(isWordedAsFindingInEveryLocale('validation.required.action')).toBe(false);
    expect(isWordedAsFindingInEveryLocale('validation.sum')).toBe(false);
  });

  it('answers no for a key no catalogue holds', () => {
    expect(isWordedAsFindingInEveryLocale('validation.nowhere')).toBe(false);
  });
});

/**
 * **Every finding's message the release ships is three parts, in every locale** (task 42.4; FR-40 AC-7, NFR-79;
 * `architecture.md` §12.5.6's task-42 row (2)). Publication holds a rule set to the messages *it* names; this holds the
 * whole `validation` namespace, so a message no seeded rule names yet cannot ship in one sentence and wait for the rule
 * that exposes it. A leaf is a message's part or it is the defect: one sentence where three are owed, or a fourth part
 * no reader renders. A blank part is `packages/i18n`'s parity suite's to refuse (`blankKeys`).
 */
describe('the committed validation messages (task 42.4; NFR-79)', () => {
  const NAMESPACE = 'validation.';
  const isPart = (segment: string): segment is FindingMessagePart =>
    (FINDING_MESSAGE_PARTS as readonly string[]).includes(segment);

  /** Each leaf under the namespace, as the message it is a part of — or the leaf itself, where it is no part. */
  const messagesOf = (leaves: readonly string[]) =>
    leaves
      .filter((leaf) => leaf.startsWith(NAMESPACE))
      .map((leaf) => {
        const cut = leaf.lastIndexOf('.');
        return { leaf, message: isPart(leaf.slice(cut + 1)) ? leaf.slice(0, cut) : null };
      });

  it.each(LOCALES)('holds no leaf in %s that is not one of a message’s three parts', (locale) => {
    const strays = messagesOf(leafKeys(COMMITTED_CATALOGUES[locale]))
      .filter((entry) => entry.message === null)
      .map((entry) => entry.leaf);
    expect(strays).toEqual([]);
  });

  it('words every message in its three parts in every locale', () => {
    const messages = new Set(
      LOCALES.flatMap((locale) =>
        messagesOf(leafKeys(COMMITTED_CATALOGUES[locale])).flatMap((entry) => (entry.message === null ? [] : [entry.message])),
      ),
    );
    // A namespace emptied by a move would otherwise pass with nothing to hold.
    expect(messages.size).toBeGreaterThan(0);
    expect([...messages].filter((message) => !isWordedAsFindingInEveryLocale(message))).toEqual([]);
  });
});
