import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { writeOutboxEvent } from '../outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { ruleFor, type SlotReplaced } from './configuration-kind-rules';
import { ConfigurationPayloadRefusedError } from './configuration-payload-refused.error';
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
  /**
   * The revision to move back to. The slot it was published for flips to it, if that slot holds a later one; no
   * other window of the scope moves (task 37.2).
   */
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
 * possible. What is left here is sequencing — and, since tasks 37.3 and 37.4, the two things a kind
 * may ask of a publication (`configuration-kind-rules.ts`): a payload refused before anything is
 * written, and an outbox event when the revision in force for a slot changes, on the same
 * transaction as the change.
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
    // Before the transaction opens: a payload no reader could use takes no lock and writes nothing (task 37.4).
    const rule = ruleFor(request.kind);
    const reason = rule.refusal?.(request.payload) ?? null;
    if (reason !== null) {
      throw new ConfigurationPayloadRefusedError({ kind: request.kind, scope: request.scope, reason });
    }

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

      // The window is recorded on the version as well as on the slot (task 37.2): it is what lets a revert find the
      // one slot this version was published for, in a scope that holds several.
      const inserted = (await runner.query(
        `INSERT INTO config.entry_version (kind, scope, revision, state, payload, created_by, published_at, validity)
         VALUES ($1, $2, $3, 'published', $4::jsonb, $5, now(), $6::daterange)
         RETURNING id`,
        [
          request.kind,
          request.scope,
          nextRevision,
          JSON.stringify(request.payload),
          request.actorId ?? null,
          validity,
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

      // A publication over an occupied window replaces what was in force there; one into an empty window replaces
      // nothing (task 37.3).
      if (slot.length > 0) {
        await announceReplacement(runner, {
          kind: request.kind,
          replaced: { scope: request.scope, leavingRevision: slot[0].revision, enteringRevision: nextRevision },
        });
      }

      return { id: inserted[0].id, revision: nextRevision };
    });
  }

  /**
   * NFR-85's one step. The pointer moves back to a version that already exists and was never
   * altered — which is why revert is safe to run under pressure and why AD-4 rejected
   * effective-dating without immutability: an edited "published" version has nothing to revert to.
   *
   * **One slot, the one the target was published for** (task 37.2). This moved every slot of the
   * scope holding a later revision, which was right while every reverted artefact held a single
   * unbounded slot and wrong for an effective-dated one: reverting a correction to a 2026 factor set
   * would have put it in force for 2027 too. The version's own recorded window names the slot; a
   * version with none recorded — one superseded before windows were kept, in a scope holding several
   * — is refused rather than guessed.
   */
  async revert(request: RevertRequest): Promise<void> {
    await this.inTransaction(async (runner) => {
      const target = (await runner.query(
        `SELECT id, validity::text AS validity FROM config.entry_version
          WHERE kind = $1 AND scope = $2 AND revision = $3`,
        [request.kind, request.scope, request.toRevision],
      )) as { id: string; validity: string | null }[];

      if (target.length === 0) {
        throw new Error(
          `No revision ${request.toRevision} of ${request.kind}/${request.scope} to revert to`,
        );
      }
      if (target[0].validity === null) {
        throw new Error(
          `Revision ${request.toRevision} of ${request.kind}/${request.scope} records no window, so the slot it ` +
            `was published for is not known; publish its payload again instead of reverting to it`,
        );
      }

      // The existence check comes first for `publish`'s reason: `bump_store_version` fires per
      // statement, so an UPDATE matching nothing would still move the store version and invalidate
      // every replica's cache for a revert that changed nothing.
      const slot = (await runner.query(
        `SELECT v.revision FROM config.entry_schedule s
           JOIN config.entry_version v ON v.id = s.version_id
          WHERE s.kind = $1 AND s.scope = $2 AND s.validity = $3::daterange AND v.revision > $4`,
        [request.kind, request.scope, target[0].validity, request.toRevision],
      )) as { revision: number }[];
      if (slot.length === 0) return;

      // The later versions stay in the table, published-then-superseded and untouched, so a forward
      // flip is available again without republishing anything.
      await runner.query(
        `UPDATE config.entry_schedule SET version_id = $4
          WHERE kind = $1 AND scope = $2 AND validity = $3::daterange`,
        [request.kind, request.scope, target[0].validity, target[0].id],
      );

      // A revert is a replacement too: the revision leaving is the one the slot held (task 37.3).
      await announceReplacement(runner, {
        kind: request.kind,
        replaced: { scope: request.scope, leavingRevision: slot[0].revision, enteringRevision: request.toRevision },
      });
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

/**
 * The kind's replacement event, where it names one, as a platform outbox row on the change's own transaction (P-8): it
 * commits with the new revision in force or not at all. It belongs to no organization — which ones a change reaches is
 * the handler's to find.
 */
async function announceReplacement(
  runner: QueryRunner,
  change: { readonly kind: string; readonly replaced: SlotReplaced },
): Promise<void> {
  const eventType = ruleFor(change.kind).replaced;
  if (eventType === undefined) return;
  await writeOutboxEvent(runner, { eventType, payload: { ...change.replaced }, organizationId: null });
}

/** A `[from,to)` literal, with an empty bound rendering as unbounded. */
function range(from: string | null, to: string | null): string {
  return `[${from ?? ''},${to ?? ''})`;
}
