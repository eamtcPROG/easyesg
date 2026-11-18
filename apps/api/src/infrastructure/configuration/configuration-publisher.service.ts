import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { writeOutboxEvent } from '../outbox/outbox-writer';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { ruleFor, type SlotReplaced } from './configuration-kind-rules';
import { ConfigurationDraftMissingError } from './configuration-draft-missing.error';
import { ConfigurationPayloadRefusedError } from './configuration-payload-refused.error';
import { ConfigurationRevisionMismatchError } from './configuration-revision-mismatch.error';
import { lockSlot, nextRevision, windowLiteral } from './configuration-sql';

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

/**
 * One slot of a reviewed set (tasks 67.14, 67.15): either a payload to put in force, as `publish` takes one, or **the
 * slot's draft in review**, promoted in place — its window is the one it was drafted for.
 */
export type SetEntry =
  | (PublishRequest & { readonly fromReview?: false })
  | {
      readonly kind: string;
      readonly scope: string;
      readonly fromReview: true;
      /** As `PublishRequest.expectedRevision`: the revision the reviewer saw in force, 0 for none. */
      readonly expectedRevision?: number;
    };

/** A locale's editorial sign-off (NFR-23; 182/37): who signed it off, and when — an ISO instant. */
export interface LocaleSignOff {
  readonly by: string;
  readonly at: string;
}

export interface PublishSetRequest {
  /** Every slot of the set — published together or not at all (FR-62; 182/36). At least one. */
  readonly entries: readonly SetEntry[];
  readonly actorId?: string | null;
  /** Each locale's sign-off, recorded on the publication (182/37). Empty where the set needs none. */
  readonly signOff?: Readonly<Record<string, LocaleSignOff>>;
}

/** A set in force: the publication every one of its versions names, and each version. */
export interface PublishedSet {
  readonly publicationId: string;
  readonly versions: readonly (PublishedVersion & { readonly kind: string; readonly scope: string })[];
}

/**
 * A new window opened at a date on an effective-dated slot (task 67.21; FR-66; 182/52) — the open-ended window in
 * force is closed the day before `at` and the new payload is in force from `at`.
 */
export interface OpenWindowRequest {
  readonly kind: string;
  readonly scope: string;
  /** The calendar day the new payload takes effect — after the open window's own start. */
  readonly at: string;
  readonly payload: Record<string, unknown>;
  readonly actorId?: string | null;
  /** The revision of the open window the operator read; any other refuses with `ConfigurationRevisionMismatchError`. */
  readonly expectedRevision: number;
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
    refuseUnreadable(request);
    return this.inTransaction(async (runner) => {
      await lockSlot(runner, request);
      return putInForce(runner, { entry: request, publicationId: null });
    });
  }

  /**
   * **A reviewed set, published by one transaction** (task 67.14; FR-62; 182/36): every slot is in force afterwards or
   * none is, and every version it writes names one publication — the row that also holds each locale's sign-off
   * (182/37). A slot that refuses — a payload no reader could use, a revision moved since the reviewer read it, a
   * draft no longer in review — rolls the whole set back. **Revert stays per slot** (`revert`), so undoing one item
   * leaves the rest in force (NFR-85).
   *
   * The slots are locked in one order — by kind, then scope — so two sets sharing slots cannot each hold one the
   * other waits for.
   */
  async publishSet(request: PublishSetRequest): Promise<PublishedSet> {
    if (request.entries.length === 0) throw new Error('A publication names at least one slot');
    for (const entry of request.entries) if (!entry.fromReview) refuseUnreadable(entry);

    return this.inTransaction(async (runner) => {
      const [publication] = (await runner.query(
        `INSERT INTO config.publication (published_by, sign_off) VALUES ($1, $2::jsonb) RETURNING id`,
        [request.actorId ?? null, JSON.stringify(request.signOff ?? {})],
      )) as { id: string }[];

      const ordered = [...request.entries].sort((a, b) =>
        a.kind === b.kind ? a.scope.localeCompare(b.scope) : a.kind.localeCompare(b.kind),
      );
      for (const entry of ordered) await lockSlot(runner, entry);

      const versions: PublishedSet['versions'][number][] = [];
      for (const entry of request.entries) {
        const version = entry.fromReview
          ? await promoteReviewed(runner, { entry, publicationId: publication.id, actorId: request.actorId ?? null })
          : await putInForce(runner, { entry: { ...entry, actorId: request.actorId ?? null }, publicationId: publication.id });
        versions.push({ ...version, kind: entry.kind, scope: entry.scope });
      }
      return { publicationId: publication.id, versions };
    });
  }

  /**
   * **An effective-dated slot's open window closed at a date and a new one opened from it** (task 67.21; 182/52) —
   * what adopting a taxonomy version from a day is. One transaction: the open window's payload is published again for
   * `[start, at)`, which **re-points the same schedule row** to that version and narrows it (the schedule holds no
   * `DELETE` grant, and the version first in force keeps the window it recorded, superseded), then the new payload is
   * published for `[at, )`. Refused where `at` does not fall after the open window's start, or the open window is not
   * the revision the operator read. **Its compensation is another adoption**, not a revert: the narrowed window's
   * version records the narrowed window, so reverting into the open window has no earlier version to find — which
   * A-04 says beside the control (UX-123's documented compensation).
   */
  async openWindow(request: OpenWindowRequest): Promise<PublishedVersion> {
    refuseUnreadable(request);
    return this.inTransaction(async (runner) => {
      await lockSlot(runner, request);
      const open = (await runner.query(
        `SELECT s.version_id, v.revision, v.payload, lower(s.validity)::text AS starts
           FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
          WHERE s.kind = $1 AND s.scope = $2 AND upper_inf(s.validity)`,
        [request.kind, request.scope],
      )) as { version_id: string; revision: number; payload: Record<string, unknown>; starts: string | null }[];
      if (open.length === 0 || open[0].revision !== request.expectedRevision) {
        throw new ConfigurationRevisionMismatchError({
          kind: request.kind,
          scope: request.scope,
          expected: request.expectedRevision,
          inForce: open[0]?.revision ?? 0,
        });
      }
      const [current] = open;
      if (current.starts !== null && request.at <= current.starts) {
        throw new ConfigurationPayloadRefusedError({
          kind: request.kind,
          scope: request.scope,
          reason: `a window opened on ${request.at} must start after the open window's ${current.starts}`,
        });
      }

      const closed = windowLiteral(current.starts, request.at);
      const closedRevision = await nextRevision(runner, request);
      const [restated] = (await runner.query(
        `INSERT INTO config.entry_version (kind, scope, revision, state, payload, created_by, published_at, validity)
         VALUES ($1, $2, $3, 'published', $4::jsonb, $5, now(), $6::daterange) RETURNING id`,
        [request.kind, request.scope, closedRevision, JSON.stringify(current.payload), request.actorId ?? null, closed],
      )) as { id: string }[];
      await runner.query(
        `UPDATE config.entry_schedule SET validity = $3::daterange, version_id = $4
          WHERE kind = $1 AND scope = $2 AND version_id = $5 AND upper_inf(validity)`,
        [request.kind, request.scope, closed, restated.id, current.version_id],
      );
      await runner.query(`UPDATE config.entry_version SET state = 'superseded' WHERE id = $1 AND state = 'published'`, [
        current.version_id,
      ]);

      return putInForce(runner, {
        entry: { kind: request.kind, scope: request.scope, payload: request.payload, validFrom: request.at, actorId: request.actorId },
        publicationId: null,
      });
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

/** A payload no reader could use, refused before anything is written (task 37.4). */
function refuseUnreadable(request: Pick<PublishRequest, 'kind' | 'scope' | 'payload'>): void {
  const reason = ruleFor(request.kind).refusal?.(request.payload) ?? null;
  if (reason !== null) {
    throw new ConfigurationPayloadRefusedError({ kind: request.kind, scope: request.scope, reason });
  }
}

interface SlotInForce {
  readonly versionId: string;
  readonly revision: number;
}

/**
 * The version in force for one window of a slot, read under the slot's lock — and the caller's expected revision
 * checked against it (task 67.11).
 */
async function slotInForce(
  runner: QueryRunner,
  slot: { readonly kind: string; readonly scope: string; readonly validity: string; readonly expectedRevision?: number },
): Promise<SlotInForce | null> {
  // The existence check comes first rather than relying on an UPDATE that matches nothing: `bump_store_version` is a
  // **statement**-level trigger, so it fires even when the statement touches no rows, and an empty UPDATE would move
  // the store version and invalidate every replica's cache for a change that did not happen.
  const rows = (await runner.query(
    `SELECT s.version_id, v.revision
       FROM config.entry_schedule s
       JOIN config.entry_version v ON v.id = s.version_id
      WHERE s.kind = $1 AND s.scope = $2 AND s.validity = $3::daterange`,
    [slot.kind, slot.scope, slot.validity],
  )) as { version_id: string; revision: number }[];
  const inForce = rows.length === 0 ? null : { versionId: rows[0].version_id, revision: rows[0].revision };

  if (slot.expectedRevision !== undefined && (inForce?.revision ?? 0) !== slot.expectedRevision) {
    throw new ConfigurationRevisionMismatchError({
      kind: slot.kind,
      scope: slot.scope,
      expected: slot.expectedRevision,
      inForce: inForce?.revision ?? 0,
    });
  }
  return inForce;
}

/**
 * The pointer flip, and it is literally that: an UPDATE of `version_id` on the slot, which is what makes revert the same
 * operation in reverse (AD-4, NFR-85). It also means the schedule needs no DELETE grant. The predecessor is retired
 * only after the successor is in force, so there is no instant at which the slot has no published version; and a
 * publication over an occupied window announces the replacement (task 37.3).
 */
async function flipSlot(
  runner: QueryRunner,
  input: {
    readonly kind: string;
    readonly scope: string;
    readonly validity: string;
    readonly previous: SlotInForce | null;
    readonly versionId: string;
    readonly revision: number;
  },
): Promise<void> {
  if (input.previous !== null) {
    await runner.query(
      `UPDATE config.entry_schedule SET version_id = $4
        WHERE kind = $1 AND scope = $2 AND validity = $3::daterange`,
      [input.kind, input.scope, input.validity, input.versionId],
    );
    await runner.query(`UPDATE config.entry_version SET state = 'superseded' WHERE id = $1 AND state = 'published'`, [
      input.previous.versionId,
    ]);
    await announceReplacement(runner, {
      kind: input.kind,
      replaced: { scope: input.scope, leavingRevision: input.previous.revision, enteringRevision: input.revision },
    });
  } else {
    await runner.query(
      `INSERT INTO config.entry_schedule (kind, scope, validity, version_id) VALUES ($1, $2, $3::daterange, $4)`,
      [input.kind, input.scope, input.validity, input.versionId],
    );
  }
}

/**
 * Writes the next revision of a slot as published and puts it in force — under the slot's lock, which the caller
 * holds. The window is recorded on the version as well as on the slot (task 37.2): it is what lets a revert find the
 * one slot this version was published for, in a scope that holds several.
 */
async function putInForce(
  runner: QueryRunner,
  input: { readonly entry: PublishRequest; readonly publicationId: string | null },
): Promise<PublishedVersion> {
  const { entry } = input;
  const validity = windowLiteral(entry.validFrom, entry.validTo);
  const previous = await slotInForce(runner, { ...entry, validity });
  const revision = await nextRevision(runner, entry);

  const [inserted] = (await runner.query(
    `INSERT INTO config.entry_version
       (kind, scope, revision, state, payload, created_by, published_at, validity, publication_id)
     VALUES ($1, $2, $3, 'published', $4::jsonb, $5, now(), $6::daterange, $7)
     RETURNING id`,
    [
      entry.kind,
      entry.scope,
      revision,
      JSON.stringify(entry.payload),
      entry.actorId ?? null,
      validity,
      input.publicationId,
    ],
  )) as { id: string }[];

  await flipSlot(runner, { kind: entry.kind, scope: entry.scope, validity, previous, versionId: inserted.id, revision });
  return { id: inserted.id, revision };
}

/**
 * The slot's draft in review, published in place (task 67.15; 182/37): its payload is judged as any publication's is,
 * it takes the slot's next revision — a version published directly since it was drafted may hold a higher number than
 * the one it was drafted under — and it names the publication. A slot with no draft in review refuses the set.
 */
async function promoteReviewed(
  runner: QueryRunner,
  input: {
    readonly entry: { readonly kind: string; readonly scope: string; readonly expectedRevision?: number };
    readonly publicationId: string;
    readonly actorId: string | null;
  },
): Promise<PublishedVersion> {
  const { entry } = input;
  const drafts = (await runner.query(
    `SELECT id, payload, coalesce(validity::text, '[,)') AS validity FROM config.entry_version
      WHERE kind = $1 AND scope = $2 AND state = 'in_review'`,
    [entry.kind, entry.scope],
  )) as { id: string; payload: Record<string, unknown>; validity: string }[];
  if (drafts.length === 0) {
    throw new ConfigurationDraftMissingError({ kind: entry.kind, scope: entry.scope, needed: 'in review' });
  }
  const [draft] = drafts;
  refuseUnreadable({ kind: entry.kind, scope: entry.scope, payload: draft.payload });

  const previous = await slotInForce(runner, { ...entry, validity: draft.validity });
  const revision = await nextRevision(runner, entry);
  await runner.query(
    `UPDATE config.entry_version
        SET state = 'published', revision = $2, published_at = now(), publication_id = $3,
            created_by = coalesce($4, created_by), validity = $5::daterange
      WHERE id = $1`,
    [draft.id, revision, input.publicationId, input.actorId, draft.validity],
  );

  await flipSlot(runner, {
    kind: entry.kind,
    scope: entry.scope,
    validity: draft.validity,
    previous,
    versionId: draft.id,
    revision,
  });
  return { id: draft.id, revision };
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
