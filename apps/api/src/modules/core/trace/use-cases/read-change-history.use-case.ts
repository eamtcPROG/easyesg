import type { TaxonomyRegistry } from '@api/contracts/taxonomy-registry.port';
import { EntityNotFoundError } from '@api/modules/core/entity/errors/entity.errors';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import { TAXONOMY_STANDARD } from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { HISTORY_SUBJECTS, columnsOf } from '../domain/history-subjects';
import { entriesOf } from '../domain/trail-entries';
import type { ChangeTrailStore } from '../interfaces/change-trail.interface';
import {
  HISTORY_SUBJECT,
  type AnswerContext,
  type HistorySubject,
  type RawEntry,
} from '../models/change-history.model';

export interface ReadChangeHistoryCommand {
  readonly subject: HistorySubject;
  /** Entries to pass over, newest first. */
  readonly skip: number;
  /** Entries to answer; `undefined` for every one. */
  readonly take: number | undefined;
}

export interface ChangeHistoryRead {
  /** The page asked for, newest first, before it is worded. */
  readonly entries: readonly RawEntry[];
  /** Every entry the subject's history holds. */
  readonly total: number;
  /** What a disclosure answer is worded against; `null` for the two record subjects. */
  readonly context: AnswerContext | null;
}

/**
 * UC-47's read (task 84.1; §12.5.6's task-84 row): one subject's history, a page of it, newest first.
 *
 * **The whole trail of the record is read and the page cut afterwards**, because an entry is a statement over a
 * rebuilt image (row (b)): the first page's newest change can only be read against every row before it. A record's
 * trail is its own fields' changes — one company's profile, one field — so the read stays small where a page would not.
 *
 * Refusals: an entity or a report the organization does not hold reads as not found, by the same row-level policy as
 * the rows they describe (FR-54's refusal). A disclosure field never answered is no refusal: it has no history yet.
 */
export class ReadChangeHistory {
  constructor(
    private readonly trail: ChangeTrailStore,
    private readonly taxonomy: TaxonomyRegistry,
  ) {}

  async execute(command: ReadChangeHistoryCommand): Promise<ChangeHistoryRead> {
    const { subject } = command;
    const shape = HISTORY_SUBJECTS[subject.kind];
    const located = await this.locate(subject);

    const rows =
      located.recordId === null
        ? []
        : await this.trail.rows({ table: shape.table, recordIds: [located.recordId], columns: columnsOf(shape) });
    const all = entriesOf({ rows, fields: shape.fields, sourced: subject.kind === HISTORY_SUBJECT.VALUE });
    const end = command.take === undefined ? undefined : command.skip + command.take;
    return { entries: all.slice(command.skip, end), total: all.length, context: located.context };
  }

  private async locate(
    subject: HistorySubject,
  ): Promise<{ readonly recordId: string | null; readonly context: AnswerContext | null }> {
    switch (subject.kind) {
      case HISTORY_SUBJECT.ORGANIZATION:
        return { recordId: await this.trail.organizationRecord(), context: null };
      case HISTORY_SUBJECT.ENTITY: {
        const recordId = await this.trail.entityRecord({ entityId: subject.entityId });
        if (recordId === null) throw new EntityNotFoundError();
        return { recordId, context: null };
      }
      case HISTORY_SUBJECT.VALUE: {
        const record = await this.trail.valueRecord(subject);
        if (record === null) throw new ReportNotFoundError();
        const element = this.taxonomy.element({
          standard: TAXONOMY_STANDARD.VSME,
          version: record.taxonomyVersion,
          key: subject.elementKey,
        });
        return {
          recordId: record.recordId,
          context: { kind: element?.kind ?? null, taxonomyVersion: record.taxonomyVersion, currency: record.currency },
        };
      }
    }
  }
}
