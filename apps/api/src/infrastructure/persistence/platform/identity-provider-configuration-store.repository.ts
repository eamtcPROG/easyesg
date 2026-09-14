import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { isSocialProvider, type SocialProvider } from '@api/contracts/identity-provider.port';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { IDENTITY_PROVIDER_CONFIG_KIND } from '@api/modules/identity/provider/constants/provider.constants';
import { readIdentityProviderPayload } from '@api/modules/identity/provider/domain/identity-provider-payload';
import { IdentityProviderChangedError } from '@api/modules/platform/admin/errors/identity-providers.errors';
import type {
  IdentityProviderConfigurationStore,
  IdentityProviderPublicationRequest,
} from '@api/modules/platform/admin/interfaces/identity-provider-configuration-store.interface';
import type {
  IdentityProviderPublication,
  IdentityProviderUsage,
  StoredIdentityProvider,
} from '@api/modules/platform/admin/models/identity-provider.model';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * A-18's store adapter (task 67.11) — the configuration store read directly rather than through
 * `ConfigurationStore`'s cache, and published into through `ConfigurationPublisher`.
 *
 * **Read from the tables, not the cache**, for two reasons the cache cannot answer: the operator who published a
 * version and when, which the read model does not carry; and what is in force *now*, where the cache may be one
 * poll behind — so a screen reloaded after a save shows the save rather than the value before it.
 *
 * **The slot is the unbounded one**, `[,)`, which is where the seed and every A-18 publication write a provider's
 * behaviour. A provider scheduled into dated windows would be a different artefact from the one A-18 edits, and
 * none is.
 */
@Injectable()
export class IdentityProviderConfigurationStoreRepository implements IdentityProviderConfigurationStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
  ) {}

  async readAll(): Promise<readonly StoredIdentityProvider[]> {
    const rows = await this.dataSource.query<InForceRow[]>(IN_FORCE, [IDENTITY_PROVIDER_CONFIG_KIND]);
    return rows.flatMap((row) => toStored(row) ?? []);
  }

  async read(provider: SocialProvider): Promise<StoredIdentityProvider | null> {
    const rows = await this.dataSource.query<InForceRow[]>(`${IN_FORCE} AND s.scope = $2`, [
      IDENTITY_PROVIDER_CONFIG_KIND,
      provider,
    ]);
    return rows.length === 0 ? null : toStored(rows[0]);
  }

  /**
   * One statement over `identity.provider_identity`, which the application already reads. An account counts
   * **without another credential** when it holds no password row and no identity through any other provider —
   * BR-ID-4's two credential kinds, the ones `isLastCredential` weighs.
   */
  async usage(): Promise<ReadonlyMap<SocialProvider, IdentityProviderUsage>> {
    const rows = await this.dataSource.query<UsageRow[]>(
      `SELECT p.provider,
              count(*)::int AS linked_accounts,
              count(*) FILTER (
                WHERE NOT EXISTS (SELECT 1 FROM identity.credential c WHERE c.account_id = p.account_id)
                  AND NOT EXISTS (
                        SELECT 1 FROM identity.provider_identity other
                         WHERE other.account_id = p.account_id AND other.provider <> p.provider)
              )::int AS without_other_credential
         FROM identity.provider_identity p
        GROUP BY p.provider`,
    );

    const usage = new Map<SocialProvider, IdentityProviderUsage>();
    for (const row of rows) {
      if (!isSocialProvider(row.provider)) continue;
      usage.set(row.provider, {
        linkedAccounts: row.linked_accounts,
        accountsWithoutOtherCredential: row.without_other_credential,
      });
    }
    return usage;
  }

  async publish(request: IdentityProviderPublicationRequest): Promise<IdentityProviderPublication> {
    const version = await this.publisher
      .publish({
        kind: IDENTITY_PROVIDER_CONFIG_KIND,
        scope: request.provider,
        payload: { ...request.settings },
        actorId: request.operatorId,
        expectedRevision: request.expectedRevision,
      })
      .catch((error: unknown) => {
        throw error instanceof ConfigurationRevisionMismatchError ? new IdentityProviderChangedError() : error;
      });

    // This replica answers S-01 with the new state at once, the others on their next poll (AD-4). `poll`, not
    // `refreshIfStale`: it never throws, and a refresh failing after the publication committed must not report
    // a change that was made as one that was not.
    await this.configurationStore.poll();

    return { id: version.id, provider: request.provider, revision: version.revision };
  }
}

/** What is in force in the unbounded slot, with the address of the operator who published it. */
const IN_FORCE = `SELECT s.scope, v.revision, v.payload, v.published_at, operator.email AS changed_by_email
                    FROM config.entry_schedule s
                    JOIN config.entry_version v ON v.id = s.version_id
                    LEFT JOIN identity.admin_account operator ON operator.id = v.created_by
                   WHERE s.kind = $1 AND s.validity = '[,)'::daterange`;

interface InForceRow {
  scope: string;
  revision: number;
  payload: Record<string, unknown>;
  published_at: Date | null;
  changed_by_email: string | null;
}

interface UsageRow {
  provider: string;
  linked_accounts: number;
  without_other_credential: number;
}

const toStored = (row: InForceRow): StoredIdentityProvider | null =>
  isSocialProvider(row.scope)
    ? {
        provider: row.scope,
        settings: readIdentityProviderPayload(row.payload),
        revision: row.revision,
        changedByEmail: row.changed_by_email,
        changedAt: row.published_at,
      }
    : null;
