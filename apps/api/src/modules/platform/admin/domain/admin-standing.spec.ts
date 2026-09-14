import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';
import type { AdminRosterAccount } from '../models/admin-roster.model';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { adminRosterRowsOf } from './admin-standing';

const now = new Date('2026-09-13T10:00:00Z');
const none: ReadonlyMap<string, number> = new Map();

const account = (email: string, overrides: Partial<AdminRosterAccount> = {}): AdminRosterAccount => ({
  id: `account-${email}`,
  email,
  role: ADMIN_ROLE.PLATFORM_ADMINISTRATOR,
  status: ADMIN_ACCOUNT_STATUS.ACTIVE,
  lockedAt: null,
  lastSignInAt: null,
  ...overrides,
});

const invitation = (email: string, expiresAt: Date) => ({
  id: `invitation-${email}`,
  email,
  role: ADMIN_ROLE.BILLING_OPERATOR,
  status: ADMIN_INVITATION_STATUS.PENDING,
  issuedAt: now,
  expiresAt,
});

describe('A-08’s account rows (task 67.4)', () => {
  it('reads one word per row from the facts, removal and suspension outranking a lockout', () => {
    const rows = adminRosterRowsOf({
      now,
      supportAccessRequests: none,
      roster: {
        accounts: [
          account('active@easyesg.md'),
          account('locked@easyesg.md', { lockedAt: now }),
          account('suspended@easyesg.md', { status: ADMIN_ACCOUNT_STATUS.SUSPENDED, lockedAt: now }),
          account('removed@easyesg.md', { status: ADMIN_ACCOUNT_STATUS.REMOVED, lockedAt: now }),
        ],
        invitations: [
          invitation('invited@easyesg.md', new Date('2026-09-14T10:00:00Z')),
          invitation('lapsed@easyesg.md', now),
        ],
      },
    });

    expect(rows.map((row) => [row.email, row.standing])).toEqual([
      ['active@easyesg.md', 'active'],
      ['locked@easyesg.md', 'locked'],
      ['suspended@easyesg.md', 'suspended'],
      ['invited@easyesg.md', 'invited'],
      ['lapsed@easyesg.md', 'lapsed'],
      ['removed@easyesg.md', 'removed'],
    ]);
  });

  it('puts invitations after the accounts that can act and removed accounts last, each group in the store’s order', () => {
    const rows = adminRosterRowsOf({
      now,
      supportAccessRequests: none,
      roster: {
        accounts: [
          account('zeta-removed@easyesg.md', { status: ADMIN_ACCOUNT_STATUS.REMOVED }),
          account('beta@easyesg.md'),
          account('alfa@easyesg.md'),
        ],
        invitations: [invitation('gamma@easyesg.md', new Date('2026-09-14T10:00:00Z'))],
      },
    });

    expect(rows.map((row) => [row.kind, row.email])).toEqual([
      ['account', 'beta@easyesg.md'],
      ['account', 'alfa@easyesg.md'],
      ['invitation', 'gamma@easyesg.md'],
      ['account', 'zeta-removed@easyesg.md'],
    ]);
  });

  it('carries an invitation’s expiry and an account’s last sign-in, never the other way round', () => {
    const signedIn = new Date('2026-09-12T08:00:00Z');
    const expires = new Date('2026-09-14T10:00:00Z');
    const [accountRow, invitationRow] = adminRosterRowsOf({
      now,
      supportAccessRequests: none,
      roster: {
        accounts: [account('alfa@easyesg.md', { lastSignInAt: signedIn })],
        invitations: [invitation('beta@easyesg.md', expires)],
      },
    });

    expect([accountRow.lastSignInAt, accountRow.expiresAt]).toEqual([signedIn, null]);
    expect([invitationRow.lastSignInAt, invitationRow.expiresAt]).toEqual([null, expires]);
  });

  it('never shows an invitation that is no longer pending', () => {
    const rows = adminRosterRowsOf({
      now,
      supportAccessRequests: none,
      roster: {
        accounts: [],
        invitations: [
          { ...invitation('accepted@easyesg.md', now), status: ADMIN_INVITATION_STATUS.ACCEPTED },
          { ...invitation('revoked@easyesg.md', now), status: ADMIN_INVITATION_STATUS.REVOKED },
        ],
      },
    });

    expect(rows).toEqual([]);
  });

  it('counts an account’s support-access requests, zero where it raised none, and none for an invitation (task 67.9)', () => {
    const rows = adminRosterRowsOf({
      now,
      supportAccessRequests: new Map([['account-asks@easyesg.md', 3]]),
      roster: {
        accounts: [
          account('asks@easyesg.md'),
          account('quiet@easyesg.md'),
          account('gone@easyesg.md', { status: ADMIN_ACCOUNT_STATUS.REMOVED }),
        ],
        invitations: [invitation('invited@easyesg.md', new Date('2026-09-14T10:00:00Z'))],
      },
    });

    // An invitation is null rather than 0: nobody has yet been anybody who could ask.
    expect(rows.map((row) => [row.email, row.supportAccessRequests])).toEqual([
      ['asks@easyesg.md', 3],
      ['quiet@easyesg.md', 0],
      ['invited@easyesg.md', null],
      ['gone@easyesg.md', 0],
    ]);
  });
});
