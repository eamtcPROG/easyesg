import {
  DISCLOSURE_KIND,
  DISCLOSURE_ORIGIN,
  DISCLOSURE_STATE,
  type DisclosureField,
  type DisclosureValueResponse,
} from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { answersHeld, servedAnswers, servedInputAnswers } from './answers-held';
import type { PendingWrite } from './autosave-state';

/** The answers the browser's interpreter reads (task 42.1; OQ-49) — served, then acknowledged, then unacknowledged. */
const field = (over: Partial<DisclosureField>): DisclosureField => ({
  elementKey: 'NumberOfEmployees',
  changeCount: 0,
  places: null,
  dimensionKey: '',
  dimensionLabel: null,
  origin: DISCLOSURE_ORIGIN.REPORTED,
  derived: false,
  derivedFrom: [],
  explanation: null,
  overriddenBy: null,
  ordinal: 0,
  currency: null,
  kind: DISCLOSURE_KIND.NUMERIC,
  periodType: 'instant',
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
  followsScope: false,
  answeredIn: null,
  applicable: true,
  applicabilityCause: null,
  drivesApplicability: false,
  ...over,
});

const committed = (over: Partial<DisclosureValueResponse>): DisclosureValueResponse => ({
  id: '00000000-0000-0000-0000-000000000001',
  elementKey: 'NumberOfEmployees',
  dimensionKey: '',
  ordinal: 0,
  valueNumeric: null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: DISCLOSURE_STATE.OK,
  notAvailableReason: null,
  carriedForward: false,
  updatedAt: 0,
  ...over,
});

const KEY = 'NumberOfEmployees\u0000\u00000';
const pending = (key: string, write: PendingWrite['write']): Record<string, PendingWrite> => ({
  [key]: { key, write, sequence: 1 },
});

describe('answersHeld', () => {
  it('reads what the step served where nothing newer is held', () => {
    const values = answersHeld({ served: servedAnswers({ fields: [field({ valueNumeric: '12' })], readOnly: false }), state: { committed: {}, committedInputs: {}, pending: {} } });
    expect(values).toEqual([expect.objectContaining({ elementKey: 'NumberOfEmployees', valueNumeric: '12' })]);
  });

  it('reads an acknowledged answer over the served one, and an unacknowledged one over both', () => {
    const served = servedAnswers({ fields: [field({ valueNumeric: '12' })], readOnly: false });
    expect(
      answersHeld({ served, state: { committed: { [KEY]: committed({ valueNumeric: '20' }) }, committedInputs: {}, pending: {} } }),
    ).toEqual([expect.objectContaining({ valueNumeric: '20' })]);
    expect(
      answersHeld({
        served,
        state: {
          committed: { [KEY]: committed({ valueNumeric: '20' }) },
          committedInputs: {},
          // The literal is the wire value of a write's state, pinned on purpose.
          pending: pending(KEY, { elementKey: 'NumberOfEmployees', valueNumeric: '31', state: 'ok' }),
        },
      }),
    ).toEqual([expect.objectContaining({ valueNumeric: '31' })]);
  });

  it('keeps a row the reporter added to the step, and leaves out an answer to another step’s element', () => {
    const values = answersHeld({
      served: servedAnswers({ fields: [field({ elementKey: 'AddressOfSite', kind: DISCLOSURE_KIND.TEXT })], readOnly: false }),
      state: {
        committed: {},
        committedInputs: {},
        pending: {
          ...pending('AddressOfSite\u0000\u00001', { elementKey: 'AddressOfSite', ordinal: 1, valueText: 'Ialoveni', state: 'ok' }),
          ...pending('Turnover\u0000\u00000', { elementKey: 'Turnover', valueNumeric: '100', state: 'ok' }),
        },
      },
    });
    expect(values.map((value) => [value.elementKey, value.ordinal])).toEqual([
      ['AddressOfSite', 0],
      ['AddressOfSite', 1],
    ]);
  });

  it('reads a declaration of not available as the answer it is', () => {
    const values = answersHeld({
      served: servedAnswers({ fields: [field({})], readOnly: false }),
      state: {
        committed: {},
        committedInputs: {},
        pending: pending(KEY, { elementKey: 'NumberOfEmployees', state: 'not_available', notAvailableReason: 'Nu știm' }),
      },
    });
    expect(values[0]?.state).toBe('not_available');
  });

  it('is not misled by an invoice line, nor by an input the step does not show', () => {
    const values = answersHeld({
      served: servedAnswers({ fields: [field({ valueNumeric: '12' })], readOnly: false }),
      state: {
        committed: {},
        committedInputs: {},
        pending: {
          ...pending('input\u0000x', { inputKey: 'x', valueNumeric: '3' }),
          ...pending('line\u0000l1', { lineId: 'l1', removed: true }),
        },
      },
    });
    expect(values).toHaveLength(1);
  });

  describe('a derivation input, which a rule names as input:<key> (task 254)', () => {
    const COVERED = 'NumberOfEmployeesCoveredByCollectiveBargainingAgreements';
    const served = servedInputAnswers([
      { key: COVERED, derives: 'PercentageOfEmployeesCoveredByCollectiveBargainingAgreements', answer: 'number', value: null, offered: null },
    ]);

    it('is served at its field’s one address, unanswered included, so the step judges it', () => {
      expect(served).toEqual([expect.objectContaining({ elementKey: `input:${COVERED}`, valueNumeric: null })]);
    });

    it('reads a queued answer over the served one', () => {
      const values = answersHeld({
        served,
        state: { committed: {}, committedInputs: {}, pending: pending(`input\u0000${COVERED}`, { inputKey: COVERED, valueNumeric: '12' }) },
      });
      expect(values).toEqual([expect.objectContaining({ elementKey: `input:${COVERED}`, valueNumeric: '12' })]);
    });

    it('keeps an acknowledged answer once it leaves the queue — the finding does not come back on the acknowledgement', () => {
      const values = answersHeld({ served, state: { committed: {}, committedInputs: { [COVERED]: '12' }, pending: {} } });
      expect(values).toEqual([expect.objectContaining({ elementKey: `input:${COVERED}`, valueNumeric: '12' })]);
    });
  });

  it('counts a default an editable step commits on arrival as the answer it is, and not on a read-only step', () => {
    const shown = field({ kind: DISCLOSURE_KIND.BOOLEAN, defaultValue: { valueText: null, valueNumeric: null, valueBoolean: true, valueDate: null } });
    // The literal is the wire value of an answer's state, pinned on purpose.
    expect(answersHeld({ served: servedAnswers({ fields: [shown], readOnly: false }), state: { committed: {}, committedInputs: {}, pending: {} } })).toEqual([
      expect.objectContaining({ valueBoolean: true, state: 'ok' }),
    ]);
    expect(answersHeld({ served: servedAnswers({ fields: [shown], readOnly: true }), state: { committed: {}, committedInputs: {}, pending: {} } })).toEqual([
      expect.objectContaining({ valueBoolean: null }),
    ]);
  });

  it('does not count a default for a field the step does not ask', () => {
    const notAsked = field({ applicable: false, defaultValue: { valueText: null, valueNumeric: '5', valueBoolean: null, valueDate: null } });
    expect(servedAnswers({ fields: [notAsked], readOnly: false })).toEqual([expect.objectContaining({ valueNumeric: null })]);
  });
});
