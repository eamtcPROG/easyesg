import { describe, expect, it } from 'vitest';
import type { ConsoleCategory } from '@easyesg/contracts';
import {
  anyEditable,
  behaviourFieldsOf,
  behaviourRequestOf,
  editableControlsOf,
  readLeadTimes,
  readRepeatInterval,
} from './category-behaviour';

const category = (overrides: Partial<ConsoleCategory>): ConsoleCategory => ({
  categoryKey: 'reporting.manual_reminder',
  mandatory: false,
  addressNotice: false,
  cadence: null,
  inForce: null,
  switchOffs: { inApp: 0, email: 0, people: 0 },
  wording: [],
  ...overrides,
});

const IN_FORCE = {
  channels: ['in_app', 'email'] as ('in_app' | 'email')[],
  classification: 'optional' as const,
  revision: 3,
  publishedAt: null,
  publishedBy: null,
  previousRevision: 2,
  previous: null,
};

describe('A-17’s behaviour form (task 67.10)', () => {
  it('opens on the behaviour in force', () => {
    expect(behaviourFieldsOf(category({ inForce: IN_FORCE }))).toEqual({
      inApp: true,
      email: true,
      classification: 'optional',
      repeatIntervalDays: '',
      leadTimesDays: '',
    });
  });

  it('opens on no channel where nothing can be read, with the classification code fixes for a mandatory one', () => {
    expect(behaviourFieldsOf(category({ mandatory: true }))).toEqual({
      inApp: false,
      email: false,
      classification: 'transactional',
      repeatIntervalDays: '',
      leadTimesDays: '',
    });
    expect(
      behaviourFieldsOf(category({ inForce: { ...IN_FORCE, channels: null, classification: null } })).classification,
    ).toBe('optional');
  });

  const FIELDS = { inApp: true, email: true, classification: 'optional' as const, repeatIntervalDays: '', leadTimesDays: '' };

  it('sends the channels ticked, in the vocabulary’s order', () => {
    expect(behaviourRequestOf({ fields: { ...FIELDS, classification: 'transactional' }, cadence: null })).toEqual({
      channels: ['in_app', 'email'],
      classification: 'transactional',
    });
    expect(behaviourRequestOf({ fields: { ...FIELDS, inApp: false }, cadence: null }).channels).toEqual(['email']);
  });

  it('opens on the cadence in force, and sends it only for the category that keeps it (task 51.2)', () => {
    const counting = category({ cadence: 'lead_times', inForce: { ...IN_FORCE, leadTimesDays: [14, 7, 1] } });
    expect(behaviourFieldsOf(counting).leadTimesDays).toBe('14, 7, 1');
    expect(behaviourFieldsOf(category({ inForce: { ...IN_FORCE, repeatIntervalDays: 7 } })).repeatIntervalDays).toBe('7');

    expect(behaviourRequestOf({ fields: { ...FIELDS, leadTimesDays: '1, 14 7' }, cadence: 'lead_times' })).toEqual({
      channels: ['in_app', 'email'],
      classification: 'optional',
      leadTimesDays: [14, 7, 1],
    });
    expect(behaviourRequestOf({ fields: { ...FIELDS, repeatIntervalDays: '14' }, cadence: 'repeat_interval' })).toMatchObject({
      repeatIntervalDays: 14,
    });
    // A typed value on a category that keeps no cadence is never sent: the api would refuse it.
    expect(behaviourRequestOf({ fields: { ...FIELDS, repeatIntervalDays: '14' }, cadence: null })).not.toHaveProperty(
      'repeatIntervalDays',
    );
  });

  it('reads a cadence’s shape as typed, leaving its bound to the api', () => {
    expect(readRepeatInterval(' 7 ')).toBe(7);
    expect(readRepeatInterval('400')).toBe(400);
    for (const text of ['', '0', '7.5', '-3', 'șapte', '07']) expect(readRepeatInterval(text)).toBeNull();

    expect(readLeadTimes('14, 7, 1')).toEqual([14, 7, 1]);
    expect(readLeadTimes('1;7 14')).toEqual([14, 7, 1]);
    for (const text of ['', '14, 14', '7, 0', '7, x', ',']) expect(readLeadTimes(text)).toBeNull();
  });

  it('fixes what code declares: a mandatory category’s email and classification, and an address notice’s in-app', () => {
    const optional = editableControlsOf({ mandatory: false, addressNotice: false });
    expect(optional).toEqual({ inApp: true, email: true, classification: true });
    expect(anyEditable(optional)).toBe(true);

    const addressNotice = editableControlsOf({ mandatory: true, addressNotice: true });
    expect(addressNotice).toEqual({ inApp: false, email: false, classification: false });
    expect(anyEditable(addressNotice)).toBe(false);
  });
});
