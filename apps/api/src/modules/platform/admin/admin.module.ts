import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import configuration, { APP_MODE, type AppConfig } from '@api/config/configuration';
import { Argon2PasswordHasher } from '@api/infrastructure/adapters/password-hasher/argon2-password.hasher';
import { JwtAdminTokens } from '@api/infrastructure/adapters/token-signer/jwt-admin-tokens';
import { NotificationModule } from '@api/modules/platform/notification/notification.module';
import { AdminReadOnly } from '@api/infrastructure/persistence/admin-readonly';
import { AdminAccountStoreRepository } from '@api/infrastructure/persistence/platform/admin-account-store.repository';
import { AdminCredentialStoreRepository } from '@api/infrastructure/persistence/platform/admin-credential-store.repository';
import { AdminInvitationBearerStoreRepository } from '@api/infrastructure/persistence/platform/admin-invitation-bearer-store.repository';
import { SystemAuditLogReaderRepository } from '@api/infrastructure/persistence/platform/system-audit-log-reader.repository';
import { AuditModule } from '@api/modules/platform/audit/audit.module';
import { AdminSessionStoreRepository } from '@api/infrastructure/persistence/platform/admin-session-store.repository';
import { IdentityProviderConfigurationStoreRepository } from '@api/infrastructure/persistence/platform/identity-provider-configuration-store.repository';
import { ConfigProviderEnvironment } from '@api/infrastructure/adapters/provider-environment/config-provider-environment.adapter';
import { OrganizationRegisterStoreRepository } from '@api/infrastructure/persistence/platform/organization-register-store.repository';
import { SupportAccessRequestCountsRepository } from '@api/infrastructure/persistence/platform/support-access-request-counts.repository';
import { SYSTEM_AUDIT_LOG, type SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { SECRET_CIPHER } from '@api/contracts/secret-cipher.port';
import { AesGcmSecretCipher } from '@api/infrastructure/adapters/secret-cipher/aes-gcm-secret.cipher';
import type { PasswordHasher } from '@api/modules/identity/account/interfaces/password-hasher.interface';
import { AdminInvitationEmailHandler } from './consumers/admin-invitation-email.handler';
import { AdminAccountsController } from './controllers/admin-accounts.controller';
import { AdminCredentialsController } from './controllers/admin-credentials.controller';
import { AdminIdentityProvidersController } from './controllers/admin-identity-providers.controller';
import { AdminInvitationAcceptanceController } from './controllers/admin-invitation-acceptance.controller';
import { AdminInvitationsController } from './controllers/admin-invitations.controller';
import { AdminSessionController } from './controllers/admin-session.controller';
import { OrganizationRegisterController } from './controllers/organization-register.controller';
import { SystemAuditLogController } from './controllers/system-audit-log.controller';
import { AdminOriginGuard } from './guards/admin-origin.guard';
import { AdminRealmGuard } from './guards/admin-realm.guard';
import {
  ADMIN_ACCOUNT_STORE,
  type AdminAccountStore,
} from './interfaces/admin-account-store.interface';
import {
  ADMIN_CREDENTIAL_STORE,
  type AdminCredentialStore,
} from './interfaces/admin-credential-store.interface';
import {
  ADMIN_INVITATION_BEARER_STORE,
  type AdminInvitationBearerStore,
} from './interfaces/admin-invitation-bearer-store.interface';
import {
  ADMIN_SESSION_STORE,
  type AdminSessionStore,
} from './interfaces/admin-session-store.interface';
import { ADMIN_TOKENS, type AdminTokens } from './interfaces/admin-token.interface';
import {
  IDENTITY_PROVIDER_CONFIGURATION_STORE,
  type IdentityProviderConfigurationStore,
} from './interfaces/identity-provider-configuration-store.interface';
import { PROVIDER_ENVIRONMENT, type ProviderEnvironment } from './interfaces/provider-environment.interface';
import {
  ORGANIZATION_REGISTER_STORE,
  type OrganizationRegisterStore,
} from './interfaces/organization-register-store.interface';
import {
  SUPPORT_ACCESS_REQUEST_COUNTS,
  type SupportAccessRequestCounts,
} from './interfaces/support-access-request-counts.interface';
import {
  SYSTEM_AUDIT_LOG_READER,
  type SystemAuditLogReader,
} from './interfaces/system-audit-log-reader.interface';
import { AdminAccountsService } from './services/admin-accounts.service';
import { AdminCredentialsService } from './services/admin-credentials.service';
import { AdminInvitationAcceptanceService } from './services/admin-invitation-acceptance.service';
import { AdminInvitationsService } from './services/admin-invitations.service';
import { AdminSessionService } from './services/admin-session.service';
import { IdentityProvidersService } from './services/identity-providers.service';
import { OrganizationRegisterService } from './services/organization-register.service';
import { SystemAuditLogService } from './services/system-audit-log.service';
import { AcceptAdminInvitation } from './use-cases/accept-admin-invitation.use-case';
import { BeginAdminReenrolment } from './use-cases/begin-admin-reenrolment.use-case';
import { BeginAdminSignIn } from './use-cases/begin-admin-sign-in.use-case';
import { ChangeAdminAccountStatus } from './use-cases/change-admin-account-status.use-case';
import { ChangeAdminPassword } from './use-cases/change-admin-password.use-case';
import { ChangeIdentityProviderState } from './use-cases/change-identity-provider-state.use-case';
import { CompleteAdminSignIn } from './use-cases/complete-admin-sign-in.use-case';
import { ConfigureIdentityProvider } from './use-cases/configure-identity-provider.use-case';
import { ConfirmAdminReenrolment } from './use-cases/confirm-admin-reenrolment.use-case';
import { InviteAdministrator } from './use-cases/invite-administrator.use-case';
import { IssueAdminRecoveryCodes } from './use-cases/issue-admin-recovery-codes.use-case';
import { ListAdminRoster } from './use-cases/list-admin-roster.use-case';
import { ListIdentityProviders } from './use-cases/list-identity-providers.use-case';
import { ListOrganizationRegister } from './use-cases/list-organization-register.use-case';
import { ListSystemAuditLog } from './use-cases/list-system-audit-log.use-case';
import { PreviewAdminInvitation } from './use-cases/preview-admin-invitation.use-case';
import { ReadAdminCredentials } from './use-cases/read-admin-credentials.use-case';
import { ReadOrganizationRegisterRow } from './use-cases/read-organization-register-row.use-case';
import { RecoverAdminSignIn } from './use-cases/recover-admin-sign-in.use-case';
import { ReleaseAdminLockout } from './use-cases/release-admin-lockout.use-case';
import { ResendAdminInvitation } from './use-cases/resend-admin-invitation.use-case';
import { ResolveAdminSession } from './use-cases/resolve-admin-session.use-case';
import { RevokeAdminInvitation } from './use-cases/revoke-admin-invitation.use-case';
import { SignOutAdmin } from './use-cases/sign-out-admin.use-case';
import { StageAdminEnrolment } from './use-cases/stage-admin-enrolment.use-case';

/**
 * `platform/admin` — FR-75, FR-76, FR-80, FR-82, FR-83
 *
 * Platform administration behind the separate admin realm (NFR-65). Task 23 fills in FR-75:
 * the realm's token handler (OQ-17 — `/auth/admin/session` on this api, sealed-cookie
 * sessions, mandatory TOTP per §12.5.6's task-23 rows; reshaped to A-01's two-step credential →
 * factor handshake by the 24 Aug 2026 review). **Task 67.3 fills in FR-76** — A-02's organization
 * register, the realm's first route beyond its handshake, reached through `AdminRealmGuard` and read
 * through `esg_admin_ro` with every acquisition logged (§12.5.6's task-67.3 row). **Task 67.4 fills in
 * FR-80 and FR-81** — A-08's accounts, their invitations and lifecycle, the system audit log's read,
 * and A-20's acceptance beside the handshake (§12.5.6's task-67.4 row). **Task 144 fills in FR-80's other
 * half** — the operator's own password, second factor and recovery codes (A-19), and the recovery sign-in
 * beside the handshake (§12.5.6's task-144 row). **Task 67.11 fills in FR-82** — A-18's social providers: their
 * behaviour published into the configuration store, their secret reported from the environment and never edited
 * (§12.5.6's task-67.11 row). FR-83 is later.
 *
 * **What this module deliberately borrows from `identity`, and why that is not a boundary
 * breach:** the Argon2id hasher port, the refresh-token mint/hash, and the throttle domain
 * (`auth-throttle.ts`, which names its cross-module consumers itself). Those are auth
 * MECHANISMS; and since task 67.11 `identity/provider`'s payload reader, FR-2's scopes and the client secrets'
 * setting names — the shape of a provider's configuration, which A-18 edits and the sign-in flow reads, so one
 * narrowing serves both; NFR-65's separation is about DATA — separate tables, cookie, secret — and §17.5
 * places FR-75's ownership here. What it must never borrow is the tenant session's tables or
 * its `SessionStore`.
 *
 * Wiring follows the house pattern: framework-free use cases built by `useFactory`
 * (`account.module.ts` is the worked example), providers split by entrypoint —
 * `AUTH_ADMIN_SECRET` and the pepper are HTTP-tier secrets, and the worker holds neither.
 */
const { mode } = configuration();

/** Module-local hasher token: the identity module registers its own for its providers, and a
 *  shared global token would be exactly the cross-realm coupling NFR-65 rules out. */
const ADMIN_PASSWORD_HASHER = Symbol('ADMIN_PASSWORD_HASHER');

const httpProviders: Provider[] = [
  AdminSessionService,
  AdminOriginGuard,
  // Applied per route by `@RequiresAdminRole`; provided here so its `AdminSessionService` resolves
  // from this module's scope rather than being constructed from an empty one.
  AdminRealmGuard,
  // `esg_admin_ro`'s one door (task 67.3), and the register's store behind it.
  AdminReadOnly,
  { provide: ORGANIZATION_REGISTER_STORE, useClass: OrganizationRegisterStoreRepository },
  OrganizationRegisterService,
  {
    provide: ListOrganizationRegister,
    inject: [ORGANIZATION_REGISTER_STORE],
    useFactory: (store: OrganizationRegisterStore) => new ListOrganizationRegister(store),
  },
  {
    provide: ReadOrganizationRegisterRow,
    inject: [ORGANIZATION_REGISTER_STORE],
    useFactory: (store: OrganizationRegisterStore) => new ReadOrganizationRegisterRow(store),
  },
  // A-08's support-access column (task 67.9): a count across every organization, so through `esg_admin_ro`.
  { provide: SUPPORT_ACCESS_REQUEST_COUNTS, useClass: SupportAccessRequestCountsRepository },
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  { provide: ADMIN_SESSION_STORE, useClass: AdminSessionStoreRepository },
  // A-08 (task 67.4): the account store, the bearer store A-20 reaches, and the log's reader behind
  // `esg_admin_ro`. The log's WRITER comes from `AuditModule`, imported below.
  { provide: ADMIN_ACCOUNT_STORE, useClass: AdminAccountStoreRepository },
  { provide: ADMIN_INVITATION_BEARER_STORE, useClass: AdminInvitationBearerStoreRepository },
  { provide: SYSTEM_AUDIT_LOG_READER, useClass: SystemAuditLogReaderRepository },
  AdminAccountsService,
  AdminInvitationsService,
  AdminInvitationAcceptanceService,
  SystemAuditLogService,
  {
    provide: ListAdminRoster,
    inject: [ADMIN_ACCOUNT_STORE, SUPPORT_ACCESS_REQUEST_COUNTS, CLOCK],
    useFactory: (store: AdminAccountStore, requests: SupportAccessRequestCounts, now: Clock) =>
      new ListAdminRoster(store, requests, now),
  },
  {
    provide: InviteAdministrator,
    inject: [ADMIN_ACCOUNT_STORE, CLOCK],
    useFactory: (store: AdminAccountStore, now: Clock) => new InviteAdministrator(store, now),
  },
  {
    provide: ResendAdminInvitation,
    inject: [ADMIN_ACCOUNT_STORE, CLOCK],
    useFactory: (store: AdminAccountStore, now: Clock) => new ResendAdminInvitation(store, now),
  },
  {
    provide: RevokeAdminInvitation,
    inject: [ADMIN_ACCOUNT_STORE, CLOCK],
    useFactory: (store: AdminAccountStore, now: Clock) => new RevokeAdminInvitation(store, now),
  },
  {
    provide: ChangeAdminAccountStatus,
    inject: [ADMIN_ACCOUNT_STORE, CLOCK],
    useFactory: (store: AdminAccountStore, now: Clock) => new ChangeAdminAccountStatus(store, now),
  },
  {
    provide: ReleaseAdminLockout,
    inject: [ADMIN_ACCOUNT_STORE, CLOCK],
    useFactory: (store: AdminAccountStore, now: Clock) => new ReleaseAdminLockout(store, now),
  },
  {
    provide: PreviewAdminInvitation,
    inject: [ADMIN_INVITATION_BEARER_STORE, CLOCK],
    useFactory: (store: AdminInvitationBearerStore, now: Clock) => new PreviewAdminInvitation(store, now),
  },
  {
    provide: StageAdminEnrolment,
    inject: [ADMIN_INVITATION_BEARER_STORE, CLOCK],
    useFactory: (store: AdminInvitationBearerStore, now: Clock) => new StageAdminEnrolment(store, now),
  },
  {
    provide: AcceptAdminInvitation,
    inject: [ADMIN_INVITATION_BEARER_STORE, ADMIN_PASSWORD_HASHER, SYSTEM_AUDIT_LOG, CLOCK],
    useFactory: (
      store: AdminInvitationBearerStore,
      hasher: PasswordHasher,
      audit: SystemAuditLog,
      now: Clock,
    ) => new AcceptAdminInvitation(store, hasher, audit, now),
  },
  {
    provide: ListSystemAuditLog,
    inject: [SYSTEM_AUDIT_LOG_READER],
    useFactory: (reader: SystemAuditLogReader) => new ListSystemAuditLog(reader),
  },
  // A-18 (task 67.11): the providers' configuration, published into the store, and what the environment says of
  // their secrets.
  { provide: IDENTITY_PROVIDER_CONFIGURATION_STORE, useClass: IdentityProviderConfigurationStoreRepository },
  { provide: PROVIDER_ENVIRONMENT, useClass: ConfigProviderEnvironment },
  IdentityProvidersService,
  {
    provide: ListIdentityProviders,
    inject: [IDENTITY_PROVIDER_CONFIGURATION_STORE, PROVIDER_ENVIRONMENT],
    useFactory: (store: IdentityProviderConfigurationStore, environment: ProviderEnvironment) =>
      new ListIdentityProviders(store, environment),
  },
  {
    provide: ConfigureIdentityProvider,
    inject: [IDENTITY_PROVIDER_CONFIGURATION_STORE, PROVIDER_ENVIRONMENT],
    useFactory: (store: IdentityProviderConfigurationStore, environment: ProviderEnvironment) =>
      new ConfigureIdentityProvider(store, environment),
  },
  {
    provide: ChangeIdentityProviderState,
    inject: [IDENTITY_PROVIDER_CONFIGURATION_STORE, PROVIDER_ENVIRONMENT],
    useFactory: (store: IdentityProviderConfigurationStore, environment: ProviderEnvironment) =>
      new ChangeIdentityProviderState(store, environment),
  },
  // A-19 (task 144): the operator's own credentials, over a store of their own that seals the staged factor.
  { provide: ADMIN_CREDENTIAL_STORE, useClass: AdminCredentialStoreRepository },
  AdminCredentialsService,
  {
    provide: ReadAdminCredentials,
    inject: [ADMIN_CREDENTIAL_STORE],
    useFactory: (store: AdminCredentialStore) => new ReadAdminCredentials(store),
  },
  {
    provide: ChangeAdminPassword,
    inject: [ADMIN_CREDENTIAL_STORE, ADMIN_PASSWORD_HASHER, CLOCK],
    useFactory: (store: AdminCredentialStore, hasher: PasswordHasher, now: Clock) =>
      new ChangeAdminPassword(store, hasher, now),
  },
  {
    provide: BeginAdminReenrolment,
    inject: [ADMIN_CREDENTIAL_STORE, ADMIN_PASSWORD_HASHER, CLOCK],
    useFactory: (store: AdminCredentialStore, hasher: PasswordHasher, now: Clock) =>
      new BeginAdminReenrolment(store, hasher, now),
  },
  {
    provide: ConfirmAdminReenrolment,
    inject: [ADMIN_CREDENTIAL_STORE, ADMIN_PASSWORD_HASHER, CLOCK],
    useFactory: (store: AdminCredentialStore, hasher: PasswordHasher, now: Clock) =>
      new ConfirmAdminReenrolment(store, hasher, now),
  },
  {
    provide: IssueAdminRecoveryCodes,
    inject: [ADMIN_CREDENTIAL_STORE, ADMIN_PASSWORD_HASHER, CLOCK],
    useFactory: (store: AdminCredentialStore, hasher: PasswordHasher, now: Clock) =>
      new IssueAdminRecoveryCodes(store, hasher, now),
  },
  {
    // The store opens `totp_secret` on the way out (task 27.1). Registered here rather than
    // globally because this is the only module holding a sealed column today; task 27.2's
    // tenant secrets register the same adapter in `identity`, under the same one key.
    provide: SECRET_CIPHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new AesGcmSecretCipher(config.get('secrets.encryptionKey', { infer: true })),
  },
  {
    provide: ADMIN_PASSWORD_HASHER,
    inject: [ConfigService],
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new Argon2PasswordHasher(config.get('auth.passwordPepper', { infer: true })),
  },
  {
    provide: ADMIN_TOKENS,
    inject: [ConfigService],
    // Constructed lazily per boot like the tenant signer: emit-openapi's preview mode
    // instantiates no provider, so the hermetic gates need no secret.
    useFactory: (config: ConfigService<AppConfig, true>) =>
      new JwtAdminTokens(config.get('auth.adminSecret', { infer: true })),
  },
  {
    provide: BeginAdminSignIn,
    inject: [ADMIN_SESSION_STORE, ADMIN_PASSWORD_HASHER, SYSTEM_AUDIT_LOG, CLOCK],
    useFactory: (
      store: AdminSessionStore,
      hasher: PasswordHasher,
      audit: SystemAuditLog,
      now: Clock,
    ) =>
      new BeginAdminSignIn(store, hasher, audit, now),
  },
  {
    provide: CompleteAdminSignIn,
    inject: [ADMIN_SESSION_STORE, ADMIN_TOKENS, SYSTEM_AUDIT_LOG, CLOCK],
    useFactory: (
      store: AdminSessionStore,
      tokens: AdminTokens,
      audit: SystemAuditLog,
      now: Clock,
    ) =>
      new CompleteAdminSignIn(store, tokens, audit, now),
  },
  {
    provide: ResolveAdminSession,
    inject: [ADMIN_SESSION_STORE, ADMIN_TOKENS, CLOCK],
    useFactory: (store: AdminSessionStore, tokens: AdminTokens, now: Clock) =>
      new ResolveAdminSession(store, tokens, now),
  },
  {
    provide: SignOutAdmin,
    inject: [ADMIN_SESSION_STORE, CLOCK],
    useFactory: (store: AdminSessionStore, now: Clock) => new SignOutAdmin(store, now),
  },
  {
    // Task 144: the recovery sign-in, over the session store because what it ends in is a session.
    provide: RecoverAdminSignIn,
    inject: [ADMIN_SESSION_STORE, ADMIN_PASSWORD_HASHER, ADMIN_TOKENS, SYSTEM_AUDIT_LOG, CLOCK],
    useFactory: (
      store: AdminSessionStore,
      hasher: PasswordHasher,
      tokens: AdminTokens,
      audit: SystemAuditLog,
      now: Clock,
    ) => new RecoverAdminSignIn(store, hasher, tokens, audit, now),
  },
];

/** The worker sends A-08's invitation email and nothing else of this module (task 67.4). */
const workerProviders: Provider[] = [AdminInvitationEmailHandler];

@Module({
  // `AuditModule` provides the log's writer to both sign-in and acceptance; the worker needs only mail.
  imports: mode === APP_MODE.WORKER ? [NotificationModule] : [AuditModule],
  controllers:
    mode === APP_MODE.WORKER
      ? []
      : [
          AdminSessionController,
          OrganizationRegisterController,
          AdminAccountsController,
          AdminInvitationsController,
          AdminInvitationAcceptanceController,
          SystemAuditLogController,
          AdminCredentialsController,
          AdminIdentityProvidersController,
        ],
  providers: mode === APP_MODE.WORKER ? workerProviders : httpProviders,
  // Since task 67.9, for `SupportAccessModule`. **`AdminSessionService`, not the guards**: a guard named in
  // `@UseGuards` is built as an injectable of the controller's own module, so exporting `AdminRealmGuard` changes
  // nothing and what that module needs is the guard's dependency — the preview boot refused exactly that. And its
  // log is read through the same logged `esg_admin_ro` door A-02 and A-08 use — one instance, not a second.
  exports: mode === APP_MODE.WORKER ? [] : [AdminSessionService, AdminReadOnly],
})
export class AdminModule {}
