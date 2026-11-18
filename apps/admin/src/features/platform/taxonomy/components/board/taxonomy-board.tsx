import type { TaxonomyConsole } from '@easyesg/contracts';
import { useTranslations } from 'use-intl';
import { diffLocaleOf, openPair, type TaxonomySearch } from '../../tools/taxonomy-search';
import { AdoptionRegion } from '../adoption/adoption-region';
import { ExposureRegion } from '../exposure/exposure-region';
import { LabelDiffRegion } from '../labels/label-diff-region';
import { MappingRegion } from '../mapping/mapping-region';
import { RunsRegion } from '../runs/runs-region';
import { VersionsRegion } from '../versions/versions-region';

/**
 * A-04's board (tasks 67.6, 67.7): the version record, the adoption schedule, the pair's mapping and its EFRAG label
 * diff, the exposure view, and the migration runs — the Editor half above, the Batch half (UX-123) last, as the
 * artboard orders them. **The open pair is the address's** (UX-4), defaulting to the latest two versions.
 */
export function TaxonomyBoard({
  console,
  search,
  onSearchChange,
}: {
  readonly console: TaxonomyConsole;
  readonly search: TaxonomySearch;
  readonly onSearchChange: (next: TaxonomySearch) => void;
}) {
  const t = useTranslations('platform.taxonomy');
  const pair = openPair({ search, versions: console.versions.map((version) => version.version) });

  return (
    <div className="flex flex-col gap-[var(--space-7)]">
      <header className="flex flex-col gap-[var(--space-2)]">
        <h1 className="t-heading-2">{t('title')}</h1>
        <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      </header>
      <VersionsRegion console={console} />
      <AdoptionRegion console={console} />
      <MappingRegion console={console} pair={pair} onPairChange={(next) => onSearchChange({ ...search, ...next })} />
      {pair === null ? null : (
        <LabelDiffRegion
          pair={pair}
          locale={diffLocaleOf(search)}
          onLocaleChange={(locale) => onSearchChange({ ...search, ...pair, locale })}
        />
      )}
      <ExposureRegion />
      <RunsRegion console={console} pair={pair} />
    </div>
  );
}
