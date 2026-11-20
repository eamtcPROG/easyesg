import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { ConfigurationPayloadRefusedError } from '@api/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { EMISSION_FACTOR_SET_CONFIG_KIND } from '@api/modules/core/calculator/constants/calculator.constants';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '@api/modules/core/disclosure/constants/disclosure.constants';
import { VALIDATION_RULE_SET_CONFIG_KIND } from '@api/modules/core/validation/constants/validation.constants';
import { RulesChangedError, RulesPayloadRefusedError } from '@api/modules/platform/configuration/errors/rules-console.errors';
import type { RulesConsoleStore } from '@api/modules/platform/configuration/interfaces/rules-console-store.interface';
import { RULE_FAMILY, type RuleFamily, type RulesSlot } from '@api/modules/platform/configuration/models/rules-console.model';
import { CORE_DATA_SOURCE } from '../data-source';

/** Each family's store kind — the one mapping between the console's word and the store's. */
const KIND_OF: Readonly<Record<RuleFamily, string>> = {
  [RULE_FAMILY.FACTOR_SET]: EMISSION_FACTOR_SET_CONFIG_KIND,
  [RULE_FAMILY.APPLICABILITY]: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
  [RULE_FAMILY.VALIDATION_RULES]: VALIDATION_RULE_SET_CONFIG_KIND,
};

const FAMILY_OF = new Map<string, RuleFamily>(Object.entries(KIND_OF).map(([family, kind]) => [kind, family as RuleFamily]));

/**
 * `RULES_CONSOLE_STORE` (task 67.8; §12.5.6's task-67.8 row) — the three families' slots read straight from
 * `config.entry_*`, A-03's and A-04's arrangement, and a publication through `ConfigurationPublisher` into the window it
 * was read for, against the revision read. **The store's errors become this module's refusals here**, and the cache is
 * polled after a publication so this replica reads the change at once.
 */
@Injectable()
export class RulesConsoleStoreRepository implements RulesConsoleStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
  ) {}

  async slots(): Promise<readonly RulesSlot[]> {
    const rows = await this.dataSource.query<
      { kind: string; scope: string; revision: number; payload: Record<string, unknown>; starts: string | null; ends: string | null }[]
    >(
      `SELECT s.kind, s.scope, v.revision, v.payload, lower(s.validity)::text AS starts, upper(s.validity)::text AS ends
         FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
        WHERE s.kind = ANY($1::text[])
        ORDER BY s.kind, s.scope, lower(s.validity) NULLS FIRST`,
      [Object.values(KIND_OF)],
    );
    return rows.flatMap((row): RulesSlot[] => {
      const family = FAMILY_OF.get(row.kind);
      return family === undefined
        ? []
        : [{ family, scope: row.scope, revision: row.revision, validFrom: row.starts, validTo: row.ends, payload: row.payload }];
    });
  }

  async publish(input: {
    readonly family: RuleFamily;
    readonly scope: string;
    readonly payload: Record<string, unknown>;
    readonly validFrom: string | null;
    readonly validTo: string | null;
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    try {
      const published = await this.publisher.publish({
        kind: KIND_OF[input.family],
        scope: input.scope,
        payload: input.payload,
        validFrom: input.validFrom,
        validTo: input.validTo,
        actorId: input.operatorId,
        expectedRevision: input.expectedRevision,
      });
      await this.configurationStore.poll();
      return published;
    } catch (error) {
      if (error instanceof ConfigurationPayloadRefusedError) throw new RulesPayloadRefusedError();
      if (error instanceof ConfigurationRevisionMismatchError) throw new RulesChangedError();
      throw error;
    }
  }
}
