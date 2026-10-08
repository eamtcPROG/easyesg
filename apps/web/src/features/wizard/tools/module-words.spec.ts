import { COMPLETION_STATUS, type ModuleRollUp } from '@easyesg/contracts';
import { WIZARD_STEP_STATE } from '@easyesg/ui';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import ru from '@/messages/ru.json';
import { NAMED_MODULES } from './module-names';
import {
  groupCountWords,
  moduleLabel,
  moduleName,
  moduleStatus,
  moduleSummary,
  rollUpNote,
  stepStatusNote,
} from './module-words';

const translator = (locale: 'en' | 'ro', messages: typeof ro) =>
  createTranslator({ locale, messages, namespace: 'organization.wizard' });

/** A module as the last run left it, with its outstanding count (task 42.2). */
const checked = (outstanding: number, status: ModuleRollUp['status'] = COMPLETION_STATUS.IN_PROGRESS): ModuleRollUp => ({
  module: 'B1',
  resolved: 2,
  reasoned: 0,
  outstanding,
  status,
  outstandingFields: [],
});

describe('module words', () => {
  const t = translator('en', en);

  it('names a module by its reference and its plain-language name', () => {
    expect(moduleLabel(t, 'B1')).toBe('B1 — Basis for preparation');
    expect(moduleName(t, 'C4')).toBe('Climate risks');
  });

  it('shows a module this release has no name for by its reference alone, never a key', () => {
    expect(moduleName(t, 'B12')).toBeNull();
    expect(moduleLabel(t, 'B12')).toBe('B12');
  });

  it('says what each named module covers, in each locale, and nothing for a module it has no sentence for', () => {
    // Every named module, in every catalogue: a sentence missing from one locale renders as an empty line there
    // (`request.ts`'s fallback is `''`), which no screenshot shows — so the count of distinct sentences is the check.
    for (const [locale, messages] of [
      ['en', en],
      ['ro', ro],
      ['ru', ru],
    ] as const) {
      const tLocale = createTranslator({ locale, messages, namespace: 'organization.wizard' });
      const sentences = NAMED_MODULES.map((reference) => moduleSummary(tLocale, reference));
      expect(new Set(sentences).size).toBe(NAMED_MODULES.length);
      for (const sentence of sentences) expect(sentence).toMatch(/\S.{20,}\.$/u);
    }
    expect(moduleSummary(t, 'B12')).toBeNull();
  });

  it('counts what the last run left outstanding beneath a state whose words do not, and only there (UX-11)', () => {
    expect(
      stepStatusNote(t, { state: WIZARD_STEP_STATE.NOT_STARTED, checked: checked(22, COMPLETION_STATUS.NOT_STARTED) }),
    ).toBe('22 fields left');
    // Nothing a rule asks of it, or no run to have counted: nothing to say.
    expect(stepStatusNote(t, { state: WIZARD_STEP_STATE.NOT_STARTED, checked: checked(0, COMPLETION_STATUS.NOT_STARTED) })).toBeNull();
    expect(stepStatusNote(t, { state: WIZARD_STEP_STATE.NOT_STARTED, checked: undefined })).toBeNull();
    // In progress counts in its own words; the rest leave nothing to count.
    for (const state of [
      WIZARD_STEP_STATE.IN_PROGRESS,
      WIZARD_STEP_STATE.COMPLETE,
      WIZARD_STEP_STATE.OMITTED,
      WIZARD_STEP_STATE.WAITING,
      WIZARD_STEP_STATE.INAPPLICABLE,
      WIZARD_STEP_STATE.UNCHECKED,
    ]) {
      expect(stepStatusNote(t, { state, checked: checked(3) })).toBeNull();
    }
  });

  it('says how many fields the last run left outstanding in the in-progress line', () => {
    expect(moduleStatus(t, { state: WIZARD_STEP_STATE.IN_PROGRESS, checked: checked(3) })).toBe('In progress · 3 outstanding');
  });

  it('words each of the seven states', () => {
    const lines = Object.values(WIZARD_STEP_STATE).map((state) => moduleStatus(t, { state, checked: checked(3) }));

    expect(new Set(lines).size).toBe(7);
    for (const line of lines) expect(line).not.toMatch(/rail\.|organization\./u);
  });

  it('says a group no run has counted is not checked yet, and counts one that has', () => {
    const count = { done: 2, counted: 9, discounted: [], waiting: [], checked: true };
    expect(groupCountWords(t, count)).toBe('2 of 9 done');
    expect(groupCountWords(t, { ...count, checked: false })).toBe('Not checked yet');
  });

  it('agrees in Romanian on number, which the plural carries', () => {
    const tRo = translator('ro', ro);
    expect(moduleStatus(tRo, { state: WIZARD_STEP_STATE.IN_PROGRESS, checked: checked(1) })).toBe('În lucru · un câmp rămas');
    expect(moduleStatus(tRo, { state: WIZARD_STEP_STATE.IN_PROGRESS, checked: checked(3) })).toBe(
      'În lucru · 3 câmpuri rămase',
    );
    expect(moduleStatus(tRo, { state: WIZARD_STEP_STATE.IN_PROGRESS, checked: checked(25) })).toBe(
      'În lucru · 25 de câmpuri rămase',
    );
  });
});

describe('rollUpNote', () => {
  const t = translator('en', en);
  const format = createFormatter({ locale: 'en', formats });

  it('says what is not counted, then what waits, each list joined by the locale', () => {
    expect(rollUpNote(t, format, { done: 1, counted: 3, discounted: ['B6', 'B8'], waiting: ['B5'], checked: true })).toBe(
      'Not counted: B6 and B8. B5 waits on your B1 answers.',
    );
  });

  it('says nothing when nothing is discounted and nothing waits', () => {
    expect(rollUpNote(t, format, { done: 0, counted: 2, discounted: [], waiting: [], checked: true })).toBeNull();
  });
});
