import { describe, expect, it } from 'vitest';
import { accountControlsFor, controlDisclosesConsequence } from './account-controls';

const OPERATOR = 'operator-id';
const account = (standing: 'active' | 'locked' | 'suspended' | 'removed', id = 'other-id') =>
  ({ id, kind: 'account', standing }) as const;

describe('A-08’s record controls (task 67.4)', () => {
  it('offers another operator’s active account suspension and removal', () => {
    expect(accountControlsFor({ row: account('active'), operatorId: OPERATOR })).toEqual(['suspend', 'remove']);
  });

  it('puts the lockout release first on a locked account', () => {
    expect(accountControlsFor({ row: account('locked'), operatorId: OPERATOR })).toEqual([
      'release_lockout',
      'suspend',
      'remove',
    ]);
  });

  it('offers a suspended account reactivation and removal, and a removed one nothing', () => {
    expect(accountControlsFor({ row: account('suspended'), operatorId: OPERATOR })).toEqual([
      'reactivate',
      'remove',
    ]);
    expect(accountControlsFor({ row: account('removed'), operatorId: OPERATOR })).toEqual([]);
  });

  it('never offers the reader their own suspension or removal, and still their own lockout release', () => {
    expect(accountControlsFor({ row: account('active', OPERATOR), operatorId: OPERATOR })).toEqual([]);
    expect(accountControlsFor({ row: account('locked', OPERATOR), operatorId: OPERATOR })).toEqual([
      'release_lockout',
    ]);
  });

  it('offers an invitation, lapsed or not, a resend and a revoke', () => {
    for (const standing of ['invited', 'lapsed'] as const) {
      expect(
        accountControlsFor({ row: { id: 'invitation-id', kind: 'invitation', standing }, operatorId: OPERATOR }),
      ).toEqual(['resend', 'revoke']);
    }
  });

  it('discloses consequences before a suspension or a removal, and only those', () => {
    expect(
      ['release_lockout', 'reactivate', 'suspend', 'remove', 'resend', 'revoke'].filter((control) =>
        controlDisclosesConsequence(control as never),
      ),
    ).toEqual(['suspend', 'remove']);
  });
});
