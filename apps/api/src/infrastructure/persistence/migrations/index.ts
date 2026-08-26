import { Baseline1787097600000 } from './1787097600000-baseline';
import { CoreOrganization1787140800000 } from './1787140800000-core-organization';
import { OrganizationRls1787184000000 } from './1787184000000-organization-rls';
import { AppendOnlySubstrate1787227200000 } from './1787227200000-append-only-substrate';
import { FieldChangeAudit1787248800000 } from './1787248800000-field-change-audit';
import { OutboxEvent1787263200000 } from './1787263200000-outbox-event';
import { ConfigurationStore1787270400000 } from './1787270400000-configuration-store';
import { IdentityAccount1787356800000 } from './1787356800000-identity-account';
import { IdentitySession1787443200000 } from './1787443200000-identity-session';
import { AdminRealm1787529600000 } from './1787529600000-admin-realm';
import { ProviderIdentity1787616000000 } from './1787616000000-provider-identity';
import { IdentityMembership1787702400000 } from './1787702400000-identity-membership';
import { MembershipDirectory1787788800000 } from './1787788800000-membership-directory';
import { IdentityInvitation1787875200000 } from './1787875200000-identity-invitation';
import { InvitationAcceptance1787961600000 } from './1787961600000-invitation-acceptance';
import { InvitationPolicyNarrowing1788048000000 } from './1788048000000-invitation-policy-narrowing';
import { SecretEncryptionAtRest1788134400000 } from './1788134400000-secret-encryption-at-rest';
import { TenantTotp1788220800000 } from './1788220800000-tenant-totp';
import { PasswordChangedRevocation1788307200000 } from './1788307200000-password-changed-revocation';

/**
 * The migration set, registered explicitly rather than discovered by glob.
 *
 * The usual `migrations: [__dirname + '/migrations/*{.ts,.js}']` is wrong here for two
 * reasons. The small one: tsconfig sets `declaration: true`, so `*.ts` also matches the
 * emitted `.d.ts` files in dist and TypeORM tries to load a type declaration as a migration.
 * The real one: this list is the schema's history, and a history assembled by filesystem
 * order is not reviewable — an explicit array puts every addition in a diff, orders them
 * deterministically, and fails to compile if a file is renamed or deleted out from under it.
 *
 * Adding a migration is two edits: the file, and one line here. `index.spec.ts` fails if the
 * second is forgotten, because "it worked locally and the deploy skipped a migration" is not
 * a class of bug worth discovering in production.
 */
export const migrations = [
  Baseline1787097600000,
  CoreOrganization1787140800000,
  OrganizationRls1787184000000,
  AppendOnlySubstrate1787227200000,
  FieldChangeAudit1787248800000,
  OutboxEvent1787263200000,
  ConfigurationStore1787270400000,
  IdentityAccount1787356800000,
  IdentitySession1787443200000,
  AdminRealm1787529600000,
  ProviderIdentity1787616000000,
  IdentityMembership1787702400000,
  MembershipDirectory1787788800000,
  IdentityInvitation1787875200000,
  InvitationAcceptance1787961600000,
  InvitationPolicyNarrowing1788048000000,
  SecretEncryptionAtRest1788134400000,
  TenantTotp1788220800000,
  PasswordChangedRevocation1788307200000,
];
