import { AuthRateLimitedError, PasswordPolicyViolationError } from '@api/modules/identity/account/errors/account.errors';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { hashAdminInvitationToken } from '../domain/admin-invitation-token';
import { totpCodeAt } from '../domain/totp';
import { AdminFactorInvalidError } from '../errors/admin-session.errors';
import { AdminAccountExistsError } from '../errors/admin-accounts.errors';
import {
  AdminEnrolmentMissingError,
  AdminInvitationNotAcceptableError,
} from '../errors/admin-invitation.errors';
import { ADMIN_INVITATION_STATUS } from '../models/admin-invitation.model';
import { ADMIN_ACCOUNT_STATUS, ADMIN_ROLE } from '../models/admin-session.model';
import { FakeAdminRealm, type FakeRealmInvitation } from '../testing/admin-realm.fake';
import { FakeSystemAuditLog } from '../testing/admin-session-store.fake';
import { AcceptAdminInvitation } from './accept-admin-invitation.use-case';
import { PreviewAdminInvitation } from './preview-admin-invitation.use-case';
import { StageAdminEnrolment } from './stage-admin-enrolment.use-case';

const NOW = new Date('2026-09-13T10:00:00Z');
const TOKEN = 'the-link-token';
const PASSWORD = 'Parola123!';
const CLIENT_IP = '203.0.113.7';

const hasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: ({ digest, password }) => Promise.resolve(digest === `hashed:${password}`),
};

const seedInvitation = (realm: FakeAdminRealm, overrides: Partial<FakeRealmInvitation> = {}) => {
  const invitation: FakeRealmInvitation = {
    id: realm.mintId(),
    email: 'invitat@easyesg.md',
    role: ADMIN_ROLE.BILLING_OPERATOR,
    status: ADMIN_INVITATION_STATUS.PENDING,
    issuedAt: NOW,
    expiresAt: new Date('2026-09-14T10:00:00Z'),
    tokenHash: hashAdminInvitationToken(TOKEN),
    stagedTotpSecret: null,
    invitedBy: '01920000-0000-7000-8000-0000000000aa',
    ...overrides,
  };
  realm.invitations.push(invitation);
  return invitation;
};

const steps = (realm: FakeAdminRealm, audit = new FakeSystemAuditLog()) => ({
  preview: new PreviewAdminInvitation(realm.bearerStore, () => NOW),
  stage: new StageAdminEnrolment(realm.bearerStore, () => NOW),
  accept: new AcceptAdminInvitation(realm.bearerStore, hasher, audit, () => NOW),
  audit,
});

const codeFor = (secret: string): string => {
  const code = totpCodeAt(secret, NOW);
  if (code === null) throw new Error('the staged secret did not decode');
  return code;
};

describe('A-20 — accepting an administrator invitation (task 67.4, UC-87)', () => {
  it('reads what the link invites, stages a factor, and creates the account holding both credentials', async () => {
    const realm = new FakeAdminRealm();
    const invitation = seedInvitation(realm);
    const { preview, stage, accept, audit } = steps(realm);

    await expect(preview.execute({ token: TOKEN, clientIp: CLIENT_IP })).resolves.toEqual({
      email: 'invitat@easyesg.md',
      role: 'billing_operator',
      expiresAt: invitation.expiresAt,
    });

    const offer = await stage.execute({ token: TOKEN, clientIp: CLIENT_IP });
    expect(offer.uri).toContain('EasyESG%20Admin');
    expect(offer.uri).toContain(offer.secret);

    const accepted = await accept.execute({
      token: TOKEN,
      clientIp: CLIENT_IP,
      password: PASSWORD,
      totpCode: codeFor(offer.secret),
    });

    expect(realm.accountById(accepted.accountId)).toMatchObject({
      email: 'invitat@easyesg.md',
      role: 'billing_operator',
      status: 'active',
      passwordHash: `hashed:${PASSWORD}`,
      totpSecret: offer.secret,
    });
    expect(realm.invitations[0].status).toBe('accepted');
    expect(audit.recorded).toEqual([
      { action: 'admin.invitation.accepted', actorId: accepted.accountId, targetId: invitation.id },
    ]);
    // A live link spent nothing across all three steps.
    expect(realm.attempts).toEqual([]);
  });

  it('answers the same secret when enrolment is asked twice, so a reload does not undo a scan', async () => {
    const realm = new FakeAdminRealm();
    seedInvitation(realm);
    const { stage } = steps(realm);

    const first = await stage.execute({ token: TOKEN });
    const second = await stage.execute({ token: TOKEN });

    expect(second.secret).toBe(first.secret);
  });

  it('says what happened to a link that cannot be accepted — expired, revoked, used, or unknown', async () => {
    const cases = [
      [{ expiresAt: NOW }, 'platform.admin.invitation_standing.expired'],
      [{ status: ADMIN_INVITATION_STATUS.REVOKED }, 'platform.admin.invitation_standing.revoked'],
      [{ status: ADMIN_INVITATION_STATUS.ACCEPTED }, 'platform.admin.invitation_standing.accepted'],
      [{ tokenHash: hashAdminInvitationToken('a-replaced-token') }, 'platform.admin.invitation_standing.unknown'],
    ] as const;

    for (const [overrides, messageKey] of cases) {
      const realm = new FakeAdminRealm();
      seedInvitation(realm, overrides);

      const refused = steps(realm).preview.execute({ token: TOKEN });
      await expect(refused).rejects.toBeInstanceOf(AdminInvitationNotAcceptableError);
      await expect(refused).rejects.toMatchObject({ messageKey });
    }
  });

  it('counts each refused link against the address, commits the count, and refuses the sixth without counting it', async () => {
    const realm = new FakeAdminRealm();
    const { preview } = steps(realm);

    for (let tried = 0; tried < 5; tried += 1) {
      await expect(preview.execute({ token: `guess-${tried}`, clientIp: CLIENT_IP })).rejects.toBeInstanceOf(
        AdminInvitationNotAcceptableError,
      );
    }
    expect(realm.attempts).toHaveLength(5);

    await expect(preview.execute({ token: 'guess-5', clientIp: CLIENT_IP })).rejects.toBeInstanceOf(
      AuthRateLimitedError,
    );
    expect(realm.attempts).toHaveLength(5);
  });

  it('refuses a code that is not current without spending the window or creating anything', async () => {
    const realm = new FakeAdminRealm();
    seedInvitation(realm, { stagedTotpSecret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' });
    const { accept, audit } = steps(realm);

    await expect(
      accept.execute({ token: TOKEN, password: PASSWORD, totpCode: '000000' }),
    ).rejects.toBeInstanceOf(AdminFactorInvalidError);

    expect(realm.accounts).toEqual([]);
    expect(realm.invitations[0].status).toBe('pending');
    expect(realm.attempts).toEqual([]);
    expect(audit.recorded).toEqual([]);
  });

  it('refuses a password the policy does not admit, and an acceptance with no factor staged', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const staged = new FakeAdminRealm();
    seedInvitation(staged, { stagedTotpSecret: secret });

    await expect(
      steps(staged).accept.execute({ token: TOKEN, password: 'scurt', totpCode: codeFor(secret) }),
    ).rejects.toBeInstanceOf(PasswordPolicyViolationError);

    const unstaged = new FakeAdminRealm();
    seedInvitation(unstaged);
    await expect(
      steps(unstaged).accept.execute({ token: TOKEN, password: PASSWORD, totpCode: codeFor(secret) }),
    ).rejects.toBeInstanceOf(AdminEnrolmentMissingError);
    expect(unstaged.accounts).toEqual([]);
  });

  it('refuses when an account took the address meanwhile, and the invitation stays pending for a resend', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const realm = new FakeAdminRealm();
    seedInvitation(realm, { stagedTotpSecret: secret });
    realm.seedAccount({ email: 'invitat@easyesg.md', status: ADMIN_ACCOUNT_STATUS.SUSPENDED });

    await expect(
      steps(realm).accept.execute({ token: TOKEN, password: PASSWORD, totpCode: codeFor(secret) }),
    ).rejects.toBeInstanceOf(AdminAccountExistsError);

    expect(realm.invitations[0].status).toBe('pending');
    expect(realm.accounts).toHaveLength(1);
  });

  it('accepts a link once: the second acceptance is told the link was already used', async () => {
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
    const realm = new FakeAdminRealm();
    seedInvitation(realm, { stagedTotpSecret: secret });
    const { accept } = steps(realm);
    const command = { token: TOKEN, password: PASSWORD, totpCode: codeFor(secret) };

    await accept.execute(command);

    await expect(accept.execute(command)).rejects.toMatchObject({
      messageKey: 'platform.admin.invitation_standing.accepted',
    });
    expect(realm.accounts).toHaveLength(1);
  });
});
