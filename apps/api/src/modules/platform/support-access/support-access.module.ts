import { Module, type Provider } from '@nestjs/common';
import configuration, { APP_MODE } from '@api/config/configuration';
import { CLOCK, type Clock } from '@api/contracts/clock.port';
import { OrganizationSupportAccessStoreRepository } from '@api/infrastructure/persistence/platform/organization-support-access-store.repository';
import { SupportAccessGrantedReads } from '@api/infrastructure/persistence/platform/support-access-granted-reads';
import { SupportAccessLedgerRepository } from '@api/infrastructure/persistence/platform/support-access-ledger.repository';
import { SupportAccessLogReaderRepository } from '@api/infrastructure/persistence/platform/support-access-log-reader.repository';
import { DisclosureModule } from '@api/modules/core/disclosure/disclosure.module';
import { AdminModule } from '@api/modules/platform/admin/admin.module';
import { AdminSupportAccessController } from './controllers/admin-support-access.controller';
import { OrganizationSupportAccessController } from './controllers/organization-support-access.controller';
import { SupportAccessGrantController } from './controllers/support-access-grant.controller';
import { GRANTED_READS, type GrantedReads } from './interfaces/granted-reads.interface';
import {
  ORGANIZATION_SUPPORT_ACCESS_STORE,
  type OrganizationSupportAccessStore,
} from './interfaces/organization-support-access-store.interface';
import { SUPPORT_ACCESS_LEDGER, type SupportAccessLedger } from './interfaces/support-access-ledger.interface';
import {
  SUPPORT_ACCESS_LOG_READER,
  type SupportAccessLogReader,
} from './interfaces/support-access-log-reader.interface';
import { AdminSupportAccessService } from './services/admin-support-access.service';
import { OrganizationSupportAccessService } from './services/organization-support-access.service';
import { SupportAccessReportsService } from './services/support-access-reports.service';
import { AnswerSupportAccessRequest } from './use-cases/answer-support-access-request.use-case';
import { EndSupportAccessAsOperator } from './use-cases/end-support-access-as-operator.use-case';
import { EndSupportAccessAsOrganization } from './use-cases/end-support-access-as-organization.use-case';
import { ListSupportAccessLog } from './use-cases/list-support-access-log.use-case';
import { RaiseSupportAccessRequest } from './use-cases/raise-support-access-request.use-case';
import { ReadOrganizationSupportAccess } from './use-cases/read-organization-support-access.use-case';
import { ReadUnderSupportAccess } from './use-cases/read-under-support-access.use-case';

/**
 * `platform/support-access` — FR-77, FR-78, FR-79 (task 67.9)
 *
 * Time-boxed, reasoned, ticket-referenced grants to one organization's report data, **given by that organization's
 * own administrator** and expiring without anyone's action (D-5; FR-78 amended 14 Sep 2026; §12.5.6's task-67.9
 * row). Three surfaces: A-07's log and requests, one grant's end and the reads it opens, and the organization's
 * banner with its answers.
 *
 * **It imports `AdminModule` for the realm's guards and the logged `esg_admin_ro` door, and `DisclosureModule` for
 * the report reads a grant opens** — S-06's and S-07's own services, run inside the grant's binding. Nothing in
 * either imports this module back.
 *
 * Wiring follows the house pattern: framework-free use cases built by `useFactory`, providers for HTTP only — the
 * worker holds none of this.
 *
 * Boundary: `modules/core/**` and `modules/billing/**` may not import each other.
 * Both may import `contracts/**`. Enforced by dependency-cruiser, not by review.
 */
const { mode } = configuration();

const httpProviders: Provider[] = [
  { provide: CLOCK, useValue: (() => new Date()) as Clock },
  { provide: SUPPORT_ACCESS_LEDGER, useClass: SupportAccessLedgerRepository },
  { provide: GRANTED_READS, useClass: SupportAccessGrantedReads },
  { provide: SUPPORT_ACCESS_LOG_READER, useClass: SupportAccessLogReaderRepository },
  { provide: ORGANIZATION_SUPPORT_ACCESS_STORE, useClass: OrganizationSupportAccessStoreRepository },
  AdminSupportAccessService,
  SupportAccessReportsService,
  OrganizationSupportAccessService,
  {
    provide: RaiseSupportAccessRequest,
    inject: [SUPPORT_ACCESS_LEDGER, CLOCK],
    useFactory: (ledger: SupportAccessLedger, now: Clock) => new RaiseSupportAccessRequest(ledger, now),
  },
  {
    provide: EndSupportAccessAsOperator,
    inject: [SUPPORT_ACCESS_LEDGER, CLOCK],
    useFactory: (ledger: SupportAccessLedger, now: Clock) => new EndSupportAccessAsOperator(ledger, now),
  },
  {
    provide: ListSupportAccessLog,
    inject: [SUPPORT_ACCESS_LOG_READER, CLOCK],
    useFactory: (reader: SupportAccessLogReader, now: Clock) => new ListSupportAccessLog(reader, now),
  },
  {
    provide: ReadUnderSupportAccess,
    inject: [GRANTED_READS, CLOCK],
    useFactory: (reads: GrantedReads, now: Clock) => new ReadUnderSupportAccess(reads, now),
  },
  {
    provide: ReadOrganizationSupportAccess,
    inject: [ORGANIZATION_SUPPORT_ACCESS_STORE, CLOCK],
    useFactory: (store: OrganizationSupportAccessStore, now: Clock) => new ReadOrganizationSupportAccess(store, now),
  },
  {
    provide: AnswerSupportAccessRequest,
    inject: [ORGANIZATION_SUPPORT_ACCESS_STORE, CLOCK],
    useFactory: (store: OrganizationSupportAccessStore, now: Clock) => new AnswerSupportAccessRequest(store, now),
  },
  {
    provide: EndSupportAccessAsOrganization,
    inject: [ORGANIZATION_SUPPORT_ACCESS_STORE, CLOCK],
    useFactory: (store: OrganizationSupportAccessStore, now: Clock) => new EndSupportAccessAsOrganization(store, now),
  },
];

@Module({
  imports: mode === APP_MODE.WORKER ? [] : [AdminModule, DisclosureModule],
  controllers:
    mode === APP_MODE.WORKER
      ? []
      : [AdminSupportAccessController, SupportAccessGrantController, OrganizationSupportAccessController],
  providers: mode === APP_MODE.WORKER ? [] : httpProviders,
})
export class SupportAccessModule {}
