import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';

/** One version of an artefact as it was published, whether or not it is still in force. */
export interface ConfigVersion<T = Record<string, unknown>> {
  readonly kind: string;
  readonly scope: string;
  readonly revision: number;
  readonly payload: T;
  /** Inclusive start of the window it was published for, or null where it has none or none was recorded. */
  readonly validFrom: string | null;
  /** Exclusive end, or null. */
  readonly validTo: string | null;
}

/**
 * A published version by its revision — the read a pin needs once the version has stopped being in force (task 37.2).
 *
 * **`ConfigurationStore` answers what is in force and nothing else**, which is the read model AD-4 describes and the
 * one every replica caches. A calculation pinned to a factor set has to read *that* set years later, after a correction
 * superseded it inside its own window (NFR-19, FR-35) — and a superseded version is in no slot, so no cache of the
 * schedule holds it. This is a separate read for a separate question, rather than a second mode of the store's.
 *
 * **Published and superseded only**: both are immutable by `config.reject_published_edit()`, which is what makes a pin
 * a pin. A draft can still change and is not something a figure may rest on.
 *
 * No cache here: the payloads of the kinds that ask are small, and a consumer that validates what it reads caches the
 * validated result per revision itself, which immutability makes correct with no invalidation at all.
 */
@Injectable()
export class ConfigurationHistory {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  /**
   * One named input, because `kind` and `scope` are both free-form strings and a positional swap would answer
   * "nothing published" (CLAUDE.md, "An application-boundary call takes one object").
   */
  async version<T = Record<string, unknown>>(query: {
    readonly kind: string;
    readonly scope: string;
    readonly revision: number;
  }): Promise<ConfigVersion<T> | undefined> {
    // Bounds rather than the range, as the store reads them: `lower`/`upper` are exact because PostgreSQL
    // canonicalises a daterange to `[)`.
    const rows = await this.dataSource.query<
      { revision: number; payload: T; valid_from: string | null; valid_to: string | null }[]
    >(
      `SELECT revision, payload,
              lower(validity)::text AS valid_from,
              upper(validity)::text AS valid_to
         FROM config.entry_version
        WHERE kind = $1 AND scope = $2 AND revision = $3
          AND state IN ('published', 'superseded')`,
      [query.kind, query.scope, query.revision],
    );
    const row = rows[0];
    if (!row) return undefined;
    return {
      kind: query.kind,
      scope: query.scope,
      revision: row.revision,
      payload: row.payload,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    };
  }
}
