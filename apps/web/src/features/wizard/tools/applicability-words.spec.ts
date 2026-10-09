import { APPLICABILITY_CONDITION, type ApplicabilityCause } from '@easyesg/contracts';
import { createFormatter, createTranslator } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { formats } from '@/i18n/formats';
import en from '@/messages/en.json';
import ro from '@/messages/ro.json';
import ru from '@/messages/ru.json';
import type { ApplicabilityNote } from './applicability-notes';
import { hiddenReason, keptWords, noteWords } from './applicability-words';
import { KEPT_ANSWER } from './kept-answer';

const LOCALES = [
  ['en', en],
  ['ro', ro],
  ['ru', ru],
] as const;

const words = (locale: 'en' | 'ro' | 'ru', messages: typeof ro) => ({
  t: createTranslator({ locale, messages, namespace: 'organization.wizard.applicability' }),
  format: createFormatter({ locale, formats, timeZone: 'Europe/Chisinau' }),
});

const headcount = (answer: string | null): ApplicabilityCause => ({
  condition: APPLICABILITY_CONDITION.NUMERIC_AT_LEAST,
  drivers: [{ elementKey: 'NumberOfEmployees', label: 'Number of employees' }],
  threshold: '50',
  answer,
});

const sites: ApplicabilityCause = {
  condition: APPLICABILITY_CONDITION.ANY_ROW_ANSWERED,
  drivers: [
    { elementKey: 'AddressOfSite', label: 'Address of site' },
    { elementKey: 'CityOfSite', label: 'City of site' },
  ],
  threshold: null,
  answer: null,
};

const sector = (answer: string | null): ApplicabilityCause => ({
  condition: APPLICABILITY_CONDITION.MEMBER_WITHIN,
  drivers: [{ elementKey: 'NaceSectorClassificationCodes', label: 'NACE sector classification codes' }],
  threshold: null,
  answer,
});

const note = (cause: ApplicabilityCause, labels: string[]): ApplicabilityNote => ({
  key: 'k',
  cause,
  elementKeys: labels.map((_, index) => `Element${String(index)}`),
  labels,
});

describe('noteWords', () => {
  const { t, format } = words('en', en);

  it('quotes the headcount and its threshold, and names every question the cause brought', () => {
    expect(noteWords(t, format, note(headcount('52'), ['Employee turnover rate'])).title).toBe(
      'Because you answered 52 to “Number of employees” in B1 — 50 or more — this step also asks for Employee turnover rate.',
    );
    expect(noteWords(t, format, note(sites, ['In the area', 'Area'])).title).toBe(
      'Because you answered Address of site or City of site in B1, this step also asks for In the area and Area.',
    );
  });

  it('never quotes a sector, whose stored form is an XBRL name', () => {
    const title = noteWords(t, format, note(sector('nace:NACE_C1071'), ['Water withdrawn'])).title;
    expect(title).toBe(
      'Because of your answer to “NACE sector classification codes” in B1, this step also asks for Water withdrawn.',
    );
    expect(title).not.toContain('NACE_C');
  });

  it('falls back to neutral words, never a key, where the catalogue named nothing', () => {
    const unnamed: ApplicabilityCause = { ...headcount('52'), drivers: [{ elementKey: 'NumberOfEmployees', label: null }] };
    const title = noteWords(t, format, note(unnamed, [])).title;
    expect(title).toContain('a B1 question');
    expect(title).toContain('a further question');
    expect(title).not.toContain('NumberOfEmployees');
  });

  it.each(LOCALES)('words every kind, and says what a change does, in %s', (locale, messages) => {
    const local = words(locale, messages);
    const rendered = [headcount('52'), sites, sector('nace:NACE_C')].map((cause) =>
      noteWords(local.t, local.format, note(cause, ['X'])),
    );
    // `request.ts`'s fallback renders a missing message as '' — so a non-empty, distinct sentence per kind is the check.
    expect(new Set(rendered.map((words) => words.title)).size).toBe(3);
    expect(rendered.every((words) => words.title !== '' && words.body !== '')).toBe(true);
  });
});

describe('hiddenReason', () => {
  const { t, format } = words('en', en);

  it('says the headcount is below the threshold', () => {
    expect(hiddenReason(t, format, headcount('12'))).toBe(
      'This question is hidden because you answered 12 to “Number of employees” in B1, which is below 50.',
    );
  });

  it('says the question waits on B1 where its driver is unanswered, rather than naming a value', () => {
    expect(hiddenReason(t, format, headcount(null))).toBe(
      'This question is hidden until “Number of employees” is answered in B1.',
    );
    expect(hiddenReason(t, format, sector(null))).toBe(
      'This question is hidden until “NACE sector classification codes” is answered in B1.',
    );
  });

  it('says no site is listed, naming the site questions as alternatives', () => {
    expect(hiddenReason(t, format, sites)).toBe(
      'This question is hidden because B1 has no answer to Address of site or City of site.',
    );
  });

  it.each(LOCALES)('words every reason distinctly in %s', (locale, messages) => {
    const local = words(locale, messages);
    const reasons = [headcount('12'), headcount(null), sites, sector('nace:NACE_G')].map((cause) =>
      hiddenReason(local.t, local.format, cause),
    );
    expect(new Set(reasons).size).toBe(4);
    expect(reasons.every((reason) => reason !== '')).toBe(true);
  });
});

describe('keptWords', () => {
  const units = { m3: 'm³', ha: 'ha' };
  const kept = (locale: 'en' | 'ro', messages: typeof ro, answer: Parameters<typeof keptWords>[0]['kept']) => {
    const local = words(locale, messages);
    return keptWords({ t: local.t, format: local.format, kept: answer, units, yes: 'Yes', no: 'No' });
  };

  it('writes a quantity as the reader writes numbers, with its unit’s symbol', () => {
    expect(kept('ro', ro, { kind: KEPT_ANSWER.NUMBER, value: '250.5', unitCode: 'm3' })).toBe('250,5 m³');
    expect(kept('en', en, { kind: KEPT_ANSWER.NUMBER, value: '250.5', unitCode: 'm3' })).toBe('250.5 m³');
  });

  it('writes the unit code itself where no symbol is known, a published reference rather than nothing', () => {
    expect(kept('en', en, { kind: KEPT_ANSWER.NUMBER, value: '4', unitCode: 'sqkm' })).toBe('4 sqkm');
  });

  it('writes an amount with its currency, a boolean and a declaration', () => {
    expect(kept('en', en, { kind: KEPT_ANSWER.AMOUNT, value: '900', currency: 'MDL' })).toBe('900 MDL');
    expect(kept('en', en, { kind: KEPT_ANSWER.BOOLEAN, value: false })).toBe('No');
    expect(kept('en', en, { kind: KEPT_ANSWER.NOT_AVAILABLE })).toBe('declared not available');
  });

  it('writes a legal date as the day that went in', () => {
    expect(kept('en', en, { kind: KEPT_ANSWER.DATE, value: '2026-12-31' })).toBe('December 31, 2026');
  });

  it('lists the chosen members by their labels', () => {
    expect(kept('en', en, { kind: KEPT_ANSWER.CHOICES, labels: ['Pollution', 'Climate change'] })).toBe(
      'Pollution and Climate change',
    );
  });
});
