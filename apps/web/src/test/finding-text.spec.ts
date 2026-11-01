import sharedEn from '@easyesg/i18n/catalogues/en.json';
import sharedRo from '@easyesg/i18n/catalogues/ro.json';
import sharedRu from '@easyesg/i18n/catalogues/ru.json';
import { findInternalIdentifiers, type Locale } from '@easyesg/i18n';
import {
  RULE_SET_READ,
  VERDICT,
  elementsOf,
  evaluateRules,
  readRuleSet,
  type FieldValue,
  type Finding,
} from '@easyesg/validation';
import { createFormatter, createTranslator } from 'next-intl';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import { findingWords } from '@/features/wizard/tools/finding-words';

/**
 * **What a reader is shown for a finding, measured** (task 42.4; FR-40 AC-7, NFR-79; `architecture.md` §12.5.6's
 * task-42 row (2); the root `CLAUDE.md`'s *User-facing text carries no internal identifiers*). Every finding the shared
 * rule corpus produces is worded as the browser words it — `findingWords`, over the shared catalogue, with the values
 * formatted in the locale — in each of the three locales, and each must come out as **three non-blank sentences with
 * no internal identifier in them**: no rule id, no taxonomy element or member key, no verdict, no message key, and none
 * of the shapes `findInternalIdentifiers` recognises (a snake_case token, a requirement id, a stack frame).
 *
 * **And the corpus must word every message the catalogue holds**, so a message added without a case that produces it
 * fails here rather than shipping unread. A missing value for a placeholder throws rather than rendering the raw key.
 *
 * **In `src/test/`**, beside `rule-corpus.spec.ts`, which proves the same corpus evaluates here as stated: its subject
 * is the shared catalogue and corpus in this application's runtime, not one screen.
 */
interface CorpusCase {
  readonly name: string;
  readonly rules: unknown;
  readonly scope: readonly string[];
  readonly values: readonly FieldValue[];
  readonly prior?: readonly FieldValue[];
}

const CATALOGUES: Readonly<Record<Locale, typeof sharedRo>> = { ro: sharedRo, en: sharedEn, ru: sharedRu };
const CORPUS = resolve(dirname(createRequire(import.meta.url).resolve('@easyesg/validation/package.json')), 'corpus');
const FILES = readdirSync(CORPUS).filter((name) => name.endsWith('.json')).sort();

/** Every finding the corpus produces, with the identifiers its case declares. */
const produced = FILES.flatMap((file) => {
  const { cases } = JSON.parse(readFileSync(resolve(CORPUS, file), 'utf8')) as { readonly cases: readonly CorpusCase[] };
  return cases.flatMap((corpusCase) => {
    const reading = readRuleSet(corpusCase.rules);
    if (reading.outcome !== RULE_SET_READ.READ) throw new Error(`rules refused: ${JSON.stringify(reading.problems)}`);
    const findings = evaluateRules({
      ruleSet: reading.ruleSet,
      scope: new Set(corpusCase.scope),
      values: corpusCase.values,
      prior: corpusCase.prior,
    });
    const internal = [
      ...reading.ruleSet.rules.flatMap((rule) => [rule.id, ...elementsOf(rule)]),
      ...corpusCase.values.flatMap((value) => [value.elementKey, value.dimensionKey]),
      ...Object.values(VERDICT),
    ].filter((term): term is string => typeof term === 'string' && term !== '');
    return findings.map((finding) => ({ name: `${file} · ${corpusCase.name} · ${finding.rule}`, finding, internal }));
  });
});

/**
 * **Every identifier the corpus declares, forbidden in every finding** — not only its own case's: a message is shared by
 * every rule that names it, so an element key worded into one would reach readers of all of them. A capitalised word
 * the corpus does not declare is prose to `findInternalIdentifiers`, which is why the terms are passed at all.
 */
const INTERNAL = [...new Set(produced.flatMap((entry) => entry.internal))];

const wordsIn = (locale: Locale, finding: Finding) =>
  findingWords({
    t: createTranslator({
      locale,
      messages: { validation: CATALOGUES[locale].validation },
      namespace: 'validation',
      // A placeholder with no value is a defect, not a fallback to the raw key.
      onError: (error) => {
        throw error;
      },
    }),
    format: createFormatter({ locale, formats, timeZone: 'Europe/Chisinau' }),
    finding,
  });

/** The messages a catalogue holds: each node of the `validation` namespace whose leaves are its parts. */
const messagesOf = (node: unknown, path: string): string[] =>
  node !== null && typeof node === 'object' && Object.values(node).every((value) => typeof value === 'string')
    ? [path]
    : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) => messagesOf(value, `${path}.${key}`));

describe('a finding as the reader sees it (task 42.4; NFR-79)', () => {
  it('is produced for every message the catalogue holds', () => {
    const worded = new Set(produced.map(({ finding }) => finding.message));
    expect(messagesOf(sharedRo.validation, 'validation').filter((message) => !worded.has(message))).toEqual([]);
  });

  describe.each(Object.keys(CATALOGUES) as Locale[])('in %s', (locale) => {
    it.each(produced.map((entry) => [entry.name, entry] as const))('%s', (_, { finding }) => {
      const words = wordsIn(locale, finding);
      expect(words).not.toBeNull();
      expect(words).toHaveLength(3);
      for (const sentence of words ?? []) expect(sentence.trim()).not.toBe('');
      // A value the reader gave is quoted back on purpose — an address verbatim (FR-40 AC-13) — and is theirs, not ours:
      // it is taken out before the scan, or `example.md` would read as the member key `MD`.
      const text = Object.values(finding.params).reduce(
        (remaining, value) => remaining.split(value).join(' '),
        (words ?? []).join(' '),
      );
      expect(findInternalIdentifiers(text, [...INTERNAL, finding.message])).toEqual([]);
    });
  });
});
