import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { LegalControllerChangedError } from '@api/modules/platform/admin/errors/legal-controller.errors';
import type {
  LegalControllerPublicationRequest,
  LegalControllerStore,
} from '@api/modules/platform/admin/interfaces/legal-controller-store.interface';
import type {
  LegalControllerPublication,
  StoredLegalController,
} from '@api/modules/platform/admin/models/legal-controller.model';
import {
  LEGAL_CONTROLLER_CONFIG_KIND,
  LEGAL_CONTROLLER_CONFIG_SCOPE,
} from '@api/modules/platform/legal/constants/legal-controller.constants';
import type { LegalController } from '@api/modules/platform/legal/domain/legal-controller';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * A-21's store adapter (task 75) — `IdentityProviderConfigurationStoreRepository`'s shape over one slot: the store
 * read directly rather than through `ConfigurationStore`'s cache, for the operator who published what is in force and
 * for what is in force *now*, and published into through `ConfigurationPublisher`.
 *
 * **The slot is the unbounded one**, `[,)`, where the seed and every A-21 publication write the controller.
 *
 * **`ConfigurationPayloadRefusedError` is not mapped**, deliberately: the kind's publication rule and the use case
 * judge a controller by one function, `legalControllerFault`, so a payload the use case admits is one the rule admits,
 * and a refusal here would be a defect to see as one rather than a refusal to word.
 */
@Injectable()
export class LegalControllerStoreRepository implements LegalControllerStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
  ) {}

  async read(): Promise<StoredLegalController> {
    const rows = await this.dataSource.query<InForceRow[]>(IN_FORCE, [
      LEGAL_CONTROLLER_CONFIG_KIND,
      LEGAL_CONTROLLER_CONFIG_SCOPE,
    ]);
    const row = rows.at(0);
    if (row === undefined) return { controller: NONE, revision: 0, changedByEmail: null, changedAt: null };
    return {
      controller: controllerOf(row.payload),
      revision: row.revision,
      changedByEmail: row.changed_by_email,
      changedAt: row.published_at,
    };
  }

  async publish(request: LegalControllerPublicationRequest): Promise<LegalControllerPublication> {
    const version = await this.publisher
      .publish({
        kind: LEGAL_CONTROLLER_CONFIG_KIND,
        scope: LEGAL_CONTROLLER_CONFIG_SCOPE,
        payload: { ...request.controller },
        actorId: request.operatorId,
        expectedRevision: request.expectedRevision,
      })
      .catch((error: unknown) => {
        throw error instanceof ConfigurationRevisionMismatchError ? new LegalControllerChangedError() : error;
      });

    // This replica's documents name the new operator at once, the others on their next poll (AD-4). `poll`, not
    // `refreshIfStale`, for A-18's reason: a refresh failing after the publication committed must not report a change
    // that was made as one that was not.
    await this.configurationStore.poll();

    return { id: version.id, revision: version.revision };
  }
}

/** What is in force in the unbounded slot, with the address of the operator who published it. */
const IN_FORCE = `SELECT v.revision, v.payload, v.published_at, operator.email AS changed_by_email
                    FROM config.entry_schedule s
                    JOIN config.entry_version v ON v.id = s.version_id
                    LEFT JOIN identity.admin_account operator ON operator.id = v.created_by
                   WHERE s.kind = $1 AND s.scope = $2 AND s.validity = '[,)'::daterange`;

interface InForceRow {
  revision: number;
  payload: unknown;
  published_at: Date | null;
  changed_by_email: string | null;
}

const NONE: LegalController = { registeredName: '', idno: '', registeredAddress: '', dataProtectionEmail: '' };

/** Each fact the payload holds as text, as stored; anything else reads as empty, for the operator to fill. */
const controllerOf = (payload: unknown): LegalController => {
  const record = typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : {};
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    registeredName: text(record.registeredName),
    idno: text(record.idno),
    registeredAddress: text(record.registeredAddress),
    dataProtectionEmail: text(record.dataProtectionEmail),
  };
};
