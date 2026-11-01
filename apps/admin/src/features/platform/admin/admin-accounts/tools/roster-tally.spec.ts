import { describe, expect, it } from 'vitest';
import { rosterTallyOf } from './roster-tally';

describe('A-08’s roster tally (task 170)', () => {
  it('counts the accounts and the invitations apart, every standing included', () => {
    expect(
      rosterTallyOf([{ kind: 'account' }, { kind: 'invitation' }, { kind: 'account' }, { kind: 'account' }]),
    ).toEqual({ accounts: 3, invitations: 1 });
  });

  it('counts a roster with no invitation as none', () => {
    expect(rosterTallyOf([{ kind: 'account' }])).toEqual({ accounts: 1, invitations: 0 });
  });
});
