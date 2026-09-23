import { describe, expect, it } from 'vitest';
import type { ConsoleCategory } from '@easyesg/contracts';
import { categoryNamed, readCategoriesOutcome } from './categories-read';

const REMINDER: ConsoleCategory = {
  categoryKey: 'reporting.manual_reminder',
  mandatory: false,
  addressNotice: false,
  inForce: null,
  switchOffs: { inApp: 0, email: 0, people: 0 },
  wording: [],
};

describe('A-17’s read (task 67.10)', () => {
  it('is ready with the categories as they arrive', () => {
    expect(
      readCategoriesOutcome({ status: 'ok', value: { items: [REMINDER], total: 1, totalpages: 1 }, messages: [] }),
    ).toEqual({ kind: 'ready', categories: [REMINDER] });
  });

  it('draws a Billing Operator’s refusal as the permission state', () => {
    expect(
      readCategoriesOutcome({
        status: 'problem',
        problem: { type: 'https://easyesg.md/problems/insufficient-role', title: 'Refused', status: 403 },
      }),
    ).toEqual({ kind: 'forbidden' });
  });

  it('finds the open category, and nothing for a category not read', () => {
    expect(categoryNamed({ categories: [REMINDER], categoryKey: 'reporting.manual_reminder' })).toBe(REMINDER);
    expect(categoryNamed({ categories: [REMINDER], categoryKey: 'identity.invitation' })).toBeNull();
    expect(categoryNamed({ categories: [REMINDER], categoryKey: undefined })).toBeNull();
  });
});
