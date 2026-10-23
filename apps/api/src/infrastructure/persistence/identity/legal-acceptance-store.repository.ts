import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { LegalAcceptanceStore } from '@api/modules/identity/account/interfaces/legal-acceptance-store.interface';
import type {
  AcceptedLegalVersions,
  NewLegalAcceptance,
} from '@api/modules/identity/account/models/legal-acceptance.model';
import { CORE_DATA_SOURCE } from '../data-source';
import { insertLegalAcceptance, readAcceptedLegalVersions } from './legal-acceptance.queries';

/**
 * `LEGAL_ACCEPTANCE_STORE` over `identity.legal_acceptance` (task 195; §12.5.6's task-195 row (5)).
 *
 * **It binds no tenant**, as no `/account/*` store does: the table carries no organization, and the account id every
 * statement names is the session's, which the service resolves and no caller supplies. **One statement per call**: the
 * acceptance's read and its write are not one transaction, and need not be — two submissions racing past the read each
 * record the version in force, and a second row of the same version says nothing false.
 */
@Injectable()
export class LegalAcceptanceStoreRepository implements LegalAcceptanceStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  acceptedVersions(query: { readonly accountId: string }): Promise<AcceptedLegalVersions> {
    return readAcceptedLegalVersions(this.dataSource, query.accountId);
  }

  record(acceptance: NewLegalAcceptance): Promise<void> {
    return insertLegalAcceptance(this.dataSource, acceptance);
  }
}
