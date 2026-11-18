import type { Locale } from '@easyesg/i18n';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { TAXONOMY_FIELD_CHANGE, type TaxonomyMappings } from '@api/contracts/taxonomy-mapping.port';
import { ReportMigrationNotAwaitingError } from '../errors/report.errors';
import type { ReportMigrationDecisionStore } from '../interfaces/report-migration-decision-store.interface';
import type { MigrationReview, ReviewedField } from '../models/report-migration-review.model';

/** The one standard a report pins (OQ-45); `platform/taxonomy`'s `TAXONOMY_STANDARD.VSME`, which this context may not import. */
const STANDARD = 'vsme';

/**
 * S-49's read (task 67.20; UC-79; 182/43) — the report's migration awaiting review, and the fields the pair's published
 * mapping says changed, each named in the reader's language. **A removed field is named from the version it left**, the
 * others from the version it reached. A field neither version labels is left off the list rather than shown by its
 * element key, which no reader may see (NFR-79's rule on internal identifiers).
 */
export class ReadMigrationReview {
  constructor(
    private readonly store: ReportMigrationDecisionStore,
    private readonly mappings: TaxonomyMappings,
    private readonly labels: DisclosureLabelResolver,
  ) {}

  async execute(query: { readonly reportId: string; readonly locale: Locale }): Promise<MigrationReview> {
    const awaiting = await this.store.awaiting({ reportId: query.reportId });
    if (awaiting === null) throw new ReportMigrationNotAwaitingError();

    const mapping = this.mappings.mapping({ standard: STANDARD, from: awaiting.from, to: awaiting.to });
    const fields = (mapping?.fields ?? []).flatMap((field): ReviewedField[] => {
      const [first, second] = field.change === TAXONOMY_FIELD_CHANGE.REMOVED ? [awaiting.from, awaiting.to] : [awaiting.to, awaiting.from];
      const label =
        this.labels.label({ version: first, locale: query.locale, key: field.element }) ??
        this.labels.label({ version: second, locale: query.locale, key: field.element });
      return label === null ? [] : [{ label: label.text, change: field.change }];
    });
    return { ...awaiting, fields };
  }
}
