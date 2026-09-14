import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { ConfigurationRevisionMismatchError } from './configuration-revision-mismatch.error';

export interface PublishRequest {
  kind: string;
  scope: string;
  payload: Record<string, unknown>;
  /** Inclusive start. Omit for an artefact that is simply in force from now (AD-4's undated kinds). */
  validFrom?: string | null;
  /** Exclusive end. Omit for an open-ended range. */
  validTo?: string | null;
  actorId?: string | null;
  /**
   * The revision the caller read as in force for this slot — 0 where it read none. When given, a slot holding
   * any other revision refuses the publication with `ConfigurationRevisionMismatchError` rather than
   * overwriting a change the caller never saw (task 67.11, A-18). Omit it where no person edited a reading:
   * the seed loader compares payloads instead.
   */
  expectedRevision?: number;
}

/** A version just put in force: its id, which an audit row can name, and its revision. */
export interface PublishedVersion {
  readonly id: string;
  readonly revision: number;
}

export interface RevertRequest {
  kind: string;
  scope: string;
  /** The revision to move back to. Every slot holding a later one flips to it. */
  toRevision: number;
}

/**
 * Publication and revert (AD-4, FR-61, FR-62, NFR-85).
 *
 * AD-4: "Publication is a single transactional action that writes a new immutable version and flips
 * a pointer; revert flips the pointer back." Both methods here are exactly that — one transaction,
 * and nothing partially applied if it fails.
 *
 * The database enforces what matters and this service does not restate it: published versions are
 * immutable by trigger, two versions cannot be in force for one date by primary key, and the store
 * version is bumped by a trigger on the schedule so a publish that forgot to bump it is not
 * possible. What is left here is sequencing.
 */
@Injectable()
export class ConfigurationPublisher {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  /**
   * Writes the next revision and puts it in force, retiring whatever held that slot.
   *
   * Returns the new version's id and revision. The previous version is **superseded, not deleted** —
   * that is what makes revert a pointer flip rather than a restoration, and what NFR-19 needs so a
   * stored calculation can still be reproduced against the factor set it actually used.
   */
  async publish(request: PublishRequest): Promise<PublishedVersion> {
    return this.inTransaction(async (runner) => {
      const validity = range(request.validFrom ?? null, request.validTo ?? null);

      // One publication per slot at a time (task 67.11). A transaction-scoped advisory lock rather than
      // `FOR UPDATE` on the slot row, because a slot's first publication has no row to lock — and two of
      // those racing would compute the same revision and meet the unique key as a 500, not as a refusal.
      await runner.query(`SELECT pg_advisory_xact_lock(hashtextextended($1::text || '/' || $2::text, 0))`, [
        request.kind,
        request.scope,
      ]);

      // The existence check comes first rather than relying on an UPDATE that matches nothing:
      // `bump_store_version` is a **statement**-level trigger, so it fires even when the statement
      // touches no rows, and an empty UPDATE would move the store version and invalidate every
      // replica's cache for a change that did not happen. Read under the lock, so the revision it
      // answers is the one this publication supersedes.
      const slot = (await runner.query(
        `SELECT s.version_id, v.revision
           FROM config.entry_schedule s
           JOIN config.entry_version v ON v.id = s.version_id
          WHERE s.kind = $1 AND s.scope = $2 AND s.validity = $3::daterange`,
        [request.kind, request.scope, validity],
      )) as { version_id: string; revision: number }[];

      if (request.expectedRevision !== undefined) {
        const inForce = slot.length > 0 ? slot[0].revision : 0;
        if (inForce !== request.expectedRevision) {
          throw new ConfigurationRevisionMismatchError({
            kind: request.kind,
            scope: request.scope,
            expected: request.expectedRevision,
            inForce,
          });
        }
      }

      const nextRevision = await this.nextRevision(runner, request);

      const inserted = (await runner.query(
        `INSERT INTO config.entry_version (kind, scope, revision, state, payload, created_by, published_at)
         VALUES ($1, $2, $3, 'published', $4::jsonb, $5, now())
         RETURNING id`,
        [
          request.kind,
          request.scope,
          nextRevision,
          JSON.stringify(request.payload),
          request.actorId ?? null,
        ],
      )) as { id: string }[];

      // The pointer flip, and it is literally that: an UPDATE of `version_id` on the slot, which is
      // what makes revert the same operation in reverse (AD-4, NFR-85). It also means the schedule
      // needs no DELETE grant — an application role able to delete a slot could un-publish an
      // artefact, and nothing in AD-4 asks for that.
      if (slot.length > 0) {
        await runner.query(
          `UPDATE config.entry_schedule SET version_id = $4
            WHERE kind = $1 AND scope = $2 AND validity = $3::daterange`,
          [request.kind, request.scope, validity, inserted[0].id],
        );
      } else {
        await runner.query(
          `INSERT INTO config.entry_schedule (kind, scope, validity, version_id)
           VALUES ($1, $2, $3::daterange, $4)`,
          [request.kind, request.scope, validity, inserted[0].id],
        );
      }

      // Retired only after the successor is in force, so there is no instant at which the slot has
      // no published version.
      for (const previousId of slot.map((row) => row.version_id)) {
        await runner.query(
          `UPDATE config.entry_version SET state = 'superseded' WHERE id = $1 AND state = 'published'`,
          [previousId],
        );
      }

      return { id: inserted[0].id, revision: nextRevision };
    });
  }

  /**
   * NFR-85's one step. The pointer moves back to a version that already exists and was never
   * altered — which is why revert is safe to run under pressure and why AD-4 rejected
   * effective-dating without immutability: an edited "published" version has nothing to revert to.
   */
  async revert(request: RevertRequest): Promise<void> {
    await this.inTransaction(async (runner) => {
      const target = (await runner.query(
        `SELECT id FROM config.entry_version WHERE kind = $1 AND scope = $2 AND revision = $3`,
        [request.kind, request.scope, request.toRevision],
      )) as { id: string }[];

      if (target.length === 0) {
        throw new Error(
          `No revision ${request.toRevision} of ${request.kind}/${request.scope} to revert to`,
        );
      }

      // Every slot currently holding a later revision moves back to this one. The later versions
      // stay in the table, published-then-superseded and untouched, so a forward flip is available
      // again without republishing anything.
      await runner.query(
        `UPDATE config.entry_schedule s
            SET version_id = $4
          FROM config.entry_version v
         WHERE v.id = s.version_id
           AND s.kind = $1 AND s.scope = $2 AND v.revision > $3`,
        [request.kind, request.scope, request.toRevision, target[0].id],
      );
    });
  }

  private async nextRevision(
    runner: QueryRunner,
    slot: Pick<PublishRequest, 'kind' | 'scope'>,
  ): Promise<number> {
    const rows = (await runner.query(
      `SELECT coalesce(max(revision), 0) + 1 AS next FROM config.entry_version
        WHERE kind = $1 AND scope = $2`,
      [slot.kind, slot.scope],
    )) as { next: number }[];
    return Number(rows[0].next);
  }

  private async inTransaction<T>(fn: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await fn(runner);
      await runner.commitTransaction();
      return result;
    } catch (error) {
      await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
}

/** A `[from,to)` literal, with an empty bound rendering as unbounded. */
function range(from: string | null, to: string | null): string {
  return `[${from ?? ''},${to ?? ''})`;
}
