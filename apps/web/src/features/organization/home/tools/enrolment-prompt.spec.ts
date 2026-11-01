import { describe, expect, it } from 'vitest';
import { promptsEnrolment } from './enrolment-prompt';

const factor = (over: Partial<{ enrolled: boolean; enrolmentPromptDismissed: boolean }> = {}) => ({
  enrolled: false,
  recoveryCodesRemaining: 0,
  enrolmentPromptDismissed: false,
  ...over,
});

describe('S-05 prompt to enrol a second factor (task 190)', () => {
  it('asks an administrator who holds no factor and has not said not now', () => {
    expect(promptsEnrolment({ administers: true, factor: factor() })).toBe(true);
  });

  it.each([
    ['a member who does not administer', { administers: false, factor: factor() }],
    ['an administrator already enrolled', { administers: true, factor: factor({ enrolled: true }) }],
    ['an administrator who said not now', { administers: true, factor: factor({ enrolmentPromptDismissed: true }) }],
    ['a factor state that could not be read', { administers: true, factor: null }],
  ])('stays silent for %s', (_who, input) => {
    expect(promptsEnrolment(input)).toBe(false);
  });
});
