import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { LABEL_STANDING, type Locale } from '@easyesg/i18n';
import { labelDiff } from '../domain/label-diff';
import { TaxonomyVersionUnknownError } from '../errors/taxonomy-console.errors';
import type { LabelDiff } from '../models/taxonomy-console.model';

/**
 * A-04's EFRAG label diff (task 67.6; moved from A-03 by §12.5.6's task-67.5 row (6)): for a pair, the labels that
 * changed in a locale — **official only where EFRAG publishes that locale for both versions** (NFR-24, T-14); a
 * platform-authored locale is answered with no entries and `official: false`, since there is no EFRAG text to compare.
 */
export class ReadLabelDiff {
  constructor(private readonly labels: Pick<DisclosureLabelResolver, 'labels' | 'standing'>) {}

  execute(query: { readonly from: string; readonly to: string; readonly locale: Locale }): LabelDiff {
    const before = this.labels.labels({ version: query.from, locale: query.locale });
    const after = this.labels.labels({ version: query.to, locale: query.locale });
    if (before === null || after === null) throw new TaxonomyVersionUnknownError();
    const official =
      this.labels.standing({ version: query.from, locale: query.locale }) === LABEL_STANDING.OFFICIAL &&
      this.labels.standing({ version: query.to, locale: query.locale }) === LABEL_STANDING.OFFICIAL;
    return { ...query, official, entries: official ? labelDiff({ before, after }) : [] };
  }
}
