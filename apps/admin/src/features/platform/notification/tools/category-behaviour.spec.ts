import { describe, expect, it } from 'vitest';
import type { ConsoleCategory } from '@easyesg/contracts';
import { anyEditable, behaviourFieldsOf, behaviourRequestOf, editableControlsOf } from './category-behaviour';

const category = (overrides: Partial<ConsoleCategory>): ConsoleCategory => ({
  categoryKey: 'reporting.manual_reminder',
  mandatory: false,
  addressNotice: false,
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
    });
  });

  it('opens on no channel where nothing can be read, with the classification code fixes for a mandatory one', () => {
    expect(behaviourFieldsOf(category({ mandatory: true }))).toEqual({
      inApp: false,
      email: false,
      classification: 'transactional',
    });
    expect(
      behaviourFieldsOf(category({ inForce: { ...IN_FORCE, channels: null, classification: null } })).classification,
    ).toBe('optional');
  });

  it('sends the channels ticked, in the vocabulary’s order', () => {
    expect(behaviourRequestOf({ inApp: true, email: true, classification: 'transactional' })).toEqual({
      channels: ['in_app', 'email'],
      classification: 'transactional',
    });
    expect(behaviourRequestOf({ inApp: false, email: true, classification: 'optional' }).channels).toEqual(['email']);
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
