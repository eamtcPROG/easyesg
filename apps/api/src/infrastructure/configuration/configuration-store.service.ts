import { Injectable, Logger, type OnApplicationShutdown, type OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { CONFIG_POLL_INTERVAL_MS } from './configuration.constants';

/** One scheduled entry: a version of an artefact, and the dates it is in force for. */
interface ScheduledEntry {
  kind: string;
  scope: string;
  revision: number;
  payload: Record<string, unknown>;
  /** Inclusive. PostgreSQL canonicalises a daterange to `[)`, so the bounds need no inspection. */
  validFrom: string | null;
  /** Exclusive, or null for an unbounded artefact such as a locale registration. */
  validTo: string | null;
}

export interface ConfigEntry<T = Record<string, unknown>> {
  kind: string;
  scope: string;
  revision: number;
  payload: T;
}

/**
 * The read model AD-4 describes: a cached view of what is in force, stamped with a config version,
 * rebuilt when a poll of the single-row version table says it moved.
 *
 * **Version-based, not event-based, and AD-4 rejected the alternative for a stated reason.**
 * `LISTEN/NOTIFY` needs a pinned session, which PgBouncer in transaction pooling mode does not
 * provide, and `NOTIFY` is lossy — a replica disconnected during the notify never learns it missed
 * one and stays indefinitely stale. A poll cannot miss anything: the worst case is one interval
 * behind, which is bounded and self-correcting.
 *
 * The poll reads **one row**. It is not a periodic reload of the configuration; it is a periodic
 * question about whether a reload is needed, and the answer is almost always no.
 */
@Injectable()
export class ConfigurationStore implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ConfigurationStore.name);
  private timer?: NodeJS.Timeout;
  private version = -1n;
  private entries: ScheduledEntry[] = [];

  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async onModuleInit(): Promise<void> {
    await this.refreshIfStale();
    this.timer = setInterval(() => void this.poll(), CONFIG_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** The store version this replica's cache was built from. A test asserts propagation on it. */
  get cachedVersion(): bigint {
    return this.version;
  }

  /**
   * What is in force for `kind`/`scope` on a given day.
   *
   * The date is a **calendar date**, not an instant, and that is NFR-34 rather than convenience:
   * which factor set applies on 1 January is a local-calendar fact, and an answer that changed with
   * the reader's timezone would restate a reported figure (NFR-87).
   */
  get<T = Record<string, unknown>>(
    kind: string,
    scope: string,
    on: string = today(),
  ): ConfigEntry<T> | undefined {
    const found = this.entries.find(
      (entry) =>
        entry.kind === kind &&
        entry.scope === scope &&
        (entry.validFrom === null || entry.validFrom <= on) &&
        (entry.validTo === null || on < entry.validTo),
    );
    if (!found) return undefined;
    return {
      kind: found.kind,
      scope: found.scope,
      revision: found.revision,
      payload: found.payload as T,
    };
  }

  async poll(): Promise<void> {
    try {
      await this.refreshIfStale();
    } catch (error) {
      // Never rethrown: an unhandled rejection in a timer takes the process down, and a replica
      // serving a slightly stale configuration is better than one that is not serving at all.
      this.logger.error('Configuration poll failed; serving the cached version', error as Error);
    }
  }

  /** Returns true when the cache was rebuilt, which is what the propagation test asserts on. */
  async refreshIfStale(): Promise<boolean> {
    // A type argument, not a cast: `DataSource.query` is generic, unlike `QueryRunner.query`.
    const versionRows = await this.dataSource.query<{ version: string }[]>(
      `SELECT version::text AS version FROM config.store_version`,
    );

    const current = BigInt(versionRows[0].version);
    if (current === this.version) return false;

    // Bounds are selected rather than the range, so no daterange parsing is needed on this side.
    // `lower`/`upper` are exact because PostgreSQL canonicalises a daterange to `[)`.
    const rows = await this.dataSource.query<
      {
        kind: string;
        scope: string;
        revision: number;
        payload: Record<string, unknown>;
        valid_from: string | null;
        valid_to: string | null;
      }[]
    >(
      `SELECT s.kind, s.scope, v.revision, v.payload,
              lower(s.validity)::text AS valid_from,
              upper(s.validity)::text AS valid_to
         FROM config.entry_schedule s
         JOIN config.entry_version  v ON v.id = s.version_id
        ORDER BY s.kind, s.scope, lower(s.validity)`,
    );

    // Rebuilt wholesale rather than patched. The store is twelve artefact kinds, not a data set, so
    // a diff would be a second implementation of correctness for no measurable gain.
    this.entries = rows.map((row) => ({
      kind: row.kind,
      scope: row.scope,
      revision: row.revision,
      payload: row.payload,
      validFrom: row.valid_from,
      validTo: row.valid_to,
    }));
    this.version = current;
    return true;
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
