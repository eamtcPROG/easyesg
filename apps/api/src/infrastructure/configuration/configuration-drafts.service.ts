import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource, QueryRunner } from 'typeorm';
import { CORE_DATA_SOURCE } from '../persistence/data-source';
import { returnedRows } from '../persistence/returned-rows';
import { ConfigurationDraftMissingError } from './configuration-draft-missing.error';
import { lockSlot, nextRevision, windowLiteral } from './configuration-sql';

/** The two states a draft passes through before it is published (182/37) — `config.entry_state`'s own words. */
export const DRAFT_STATE = {
  DRAFT: 'draft',
  IN_REVIEW: 'in_review',
} as const;

export type DraftState = (typeof DRAFT_STATE)[keyof typeof DRAFT_STATE];

export interface SaveDraftRequest {
  readonly kind: string;
  readonly scope: string;
  readonly payload: Record<string, unknown>;
  /** The window the draft will be published into; omit both for a slot that is simply in force from then on. */
  readonly validFrom?: string | null;
  readonly validTo?: string | null;
  readonly actorId?: string | null;
}

/** A slot's open draft, as its editor and its reviewer read it. */
export interface OpenDraft {
  readonly id: string;
  readonly kind: string;
  readonly scope: string;
  readonly revision: number;
  readonly state: DraftState;
  readonly payload: Record<string, unknown>;
  readonly draftedBy: string | null;
  readonly draftedAt: Date;
}

/**
 * Drafts and review in the configuration store (task 67.15; FR-61, FR-62; AD-4; 182/37; §12.5.6's task-67.14/67.15
 * row (2)).
 *
 * **A draft is a version with no schedule entry**, so no reader can address it: `ConfigurationStore` caches only what
 * the schedule names, and `ConfigurationHistory` reads only published and superseded versions. **One open draft per
 * slot** — a save edits the one there is — and **a save after the draft went to review takes it back to draft**,
 * since what the reviewer read is no longer what would be published. Publishing it is `ConfigurationPublisher`'s
 * `publishSet`, which promotes the draft in place. Every step takes the slot's lock, so a draft and a publication of
 * one slot never interleave.
 *
 * **No refusal at save**: a draft may be half-translated, which is what makes it a draft. The kind's rule judges it at
 * publication, where every payload is judged.
 */
@Injectable()
export class ConfigurationDrafts {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async save(request: SaveDraftRequest): Promise<OpenDraft> {
    return this.inTransaction(async (runner) => {
      await lockSlot(runner, request);
      const validity = windowLiteral(request.validFrom, request.validTo);
      const existing = await openDraftOf(runner, request);
      if (existing !== null) {
        await runner.query(
          `UPDATE config.entry_version
              SET payload = $2::jsonb, state = '${DRAFT_STATE.DRAFT}', drafted_by = $3, created_at = now(),
                  validity = $4::daterange
            WHERE id = $1`,
          [existing.id, JSON.stringify(request.payload), request.actorId ?? null, validity],
        );
      } else {
        const revision = await nextRevision(runner, request);
        await runner.query(
          `INSERT INTO config.entry_version (kind, scope, revision, state, payload, drafted_by, validity)
           VALUES ($1, $2, $3, '${DRAFT_STATE.DRAFT}', $4::jsonb, $5, $6::daterange)`,
          [request.kind, request.scope, revision, JSON.stringify(request.payload), request.actorId ?? null, validity],
        );
      }
      const saved = await openDraftOf(runner, request);
      if (saved === null) throw new Error(`The draft of ${request.kind}/${request.scope} just saved could not be read`);
      return saved;
    });
  }

  /** The draft goes to review; refused where the slot holds no draft. */
  async submit(slot: { readonly kind: string; readonly scope: string }): Promise<OpenDraft> {
    return this.inTransaction(async (runner) => {
      await lockSlot(runner, slot);
      const draft = await openDraftOf(runner, slot);
      if (draft?.state !== DRAFT_STATE.DRAFT) {
        throw new ConfigurationDraftMissingError({ ...slot, needed: 'to submit' });
      }
      await runner.query(`UPDATE config.entry_version SET state = '${DRAFT_STATE.IN_REVIEW}' WHERE id = $1`, [draft.id]);
      return { ...draft, state: DRAFT_STATE.IN_REVIEW };
    });
  }

  /** The open draft dropped — false where there was none. What is in force is untouched. */
  async discard(slot: { readonly kind: string; readonly scope: string }): Promise<boolean> {
    return this.inTransaction(async (runner) => {
      await lockSlot(runner, slot);
      const removed = (await runner.query(
        `DELETE FROM config.entry_version
          WHERE kind = $1 AND scope = $2 AND state IN ('${DRAFT_STATE.DRAFT}', '${DRAFT_STATE.IN_REVIEW}')
          RETURNING id`,
        [slot.kind, slot.scope],
      )) as unknown;
      return returnedRows<{ id: string }>(removed).length > 0;
    });
  }

  /** Every open draft of a kind — what a console lists as in progress. */
  async openOf(input: { readonly kind: string }): Promise<readonly OpenDraft[]> {
    const rows = await this.dataSource.query<OpenDraftRow[]>(
      `${OPEN_DRAFTS} WHERE kind = $1 AND ${IS_OPEN} ORDER BY scope`,
      [input.kind],
    );
    return rows.map(toOpenDraft);
  }

  private async inTransaction<T>(work: (runner: QueryRunner) => Promise<T>): Promise<T> {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const result = await work(runner);
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

const OPEN_DRAFTS = `SELECT id, kind, scope, revision, state::text AS state, payload, drafted_by, created_at
                      FROM config.entry_version`;
const IS_OPEN = `state IN ('${DRAFT_STATE.DRAFT}', '${DRAFT_STATE.IN_REVIEW}')`;

interface OpenDraftRow {
  id: string;
  kind: string;
  scope: string;
  revision: number;
  state: DraftState;
  payload: Record<string, unknown>;
  drafted_by: string | null;
  created_at: Date;
}

const toOpenDraft = (row: OpenDraftRow): OpenDraft => ({
  id: row.id,
  kind: row.kind,
  scope: row.scope,
  revision: row.revision,
  state: row.state,
  payload: row.payload,
  draftedBy: row.drafted_by,
  draftedAt: row.created_at,
});

const openDraftOf = async (
  runner: QueryRunner,
  slot: { readonly kind: string; readonly scope: string },
): Promise<OpenDraft | null> => {
  const rows = (await runner.query(`${OPEN_DRAFTS} WHERE kind = $1 AND scope = $2 AND ${IS_OPEN}`, [
    slot.kind,
    slot.scope,
  ])) as OpenDraftRow[];
  return rows.length === 0 ? null : toOpenDraft(rows[0]);
};
