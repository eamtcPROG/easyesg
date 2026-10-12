import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureField,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { keptAnswerOf } from './kept-answer';

const field = (over: Partial<DisclosureField>): DisclosureField => ({
  elementKey: 'TotalWaterConsumption',
  changeCount: 0,
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.NUMERIC,
  periodType: 'duration',
  axes: [],
  repeating: false,
  order: 0,
  label: null,
  labelStanding: null,
  help: null,
  helpStanding: null,
  options: null,
  defaultValue: null,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  unitCodes: [],
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  fromRecord: false,
  applicable: false,
  applicabilityCause: null,
  ...over,
});

describe('keptAnswerOf', () => {
  it('reads a quantity with the unit it was answered in — literals on purpose, the wire values', () => {
    expect(keptAnswerOf(field({ valueNumeric: '1250.5', unitCode: 'm3' }))).toEqual({
      kind: 'number',
      value: '1250.5',
      unitCode: 'm3',
    });
  });

  it('keeps an answered zero, which is an answer', () => {
    expect(keptAnswerOf(field({ valueNumeric: '0' }))).toEqual({ kind: 'number', value: '0', unitCode: null });
  });

  it('reads a percent as the figure it is stored as, and an amount with the filing’s currency', () => {
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.PERCENT, valueNumeric: '0.125' }))).toEqual({
      kind: 'number',
      value: '0.125',
      unitCode: null,
    });
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.MONETARY, valueNumeric: '900', currency: 'MDL' }))).toEqual({
      kind: 'amount',
      value: '900',
      currency: 'MDL',
    });
  });

  it('reads a declaration of not available as that, whatever its columns hold', () => {
    expect(keptAnswerOf(field({ state: DISCLOSURE_STATE.NOT_AVAILABLE }))).toEqual({ kind: 'not_available' });
  });

  it('reads a boolean, a false one included', () => {
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.BOOLEAN, valueBoolean: false }))).toEqual({
      kind: 'boolean',
      value: false,
    });
  });

  it('names a choice by its members’ labels, never by the qualified name it stores', () => {
    const choice = field({
      kind: DISCLOSURE_KIND.ENUMERATION_SET,
      valueText: 'vsme:ClimateChangeMember vsme:PollutionMember',
      options: [
        { value: 'vsme:ClimateChangeMember', label: 'Schimbările climatice', code: null, hazardous: null },
        { value: 'vsme:PollutionMember', label: 'Poluare', code: null, hazardous: null },
      ],
    });
    expect(keptAnswerOf(choice)).toEqual({ kind: 'choices', labels: ['Schimbările climatice', 'Poluare'] });
  });

  it('says nothing of a choice the catalogue names none of, rather than quote an XBRL name', () => {
    const unnamed = field({ kind: DISCLOSURE_KIND.ENUMERATION, valueText: 'country:MD', options: [] });
    expect(keptAnswerOf(unnamed)).toBeNull();
  });

  it('reads the reporter’s own text, and nothing from an empty column', () => {
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.TEXT_BLOCK, valueText: 'Settled in full.' }))).toEqual({
      kind: 'text',
      value: 'Settled in full.',
    });
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.TEXT, valueText: '  ' }))).toBeNull();
  });

  it('reads a calendar date as stored, for the caller to format', () => {
    expect(keptAnswerOf(field({ kind: DISCLOSURE_KIND.DATE, valueDate: '2026-12-31' }))).toEqual({
      kind: 'date',
      value: '2026-12-31',
    });
  });
});
