import { useQuery } from '@tanstack/react-query';
import { API_OUTCOME, type TaxonomyConsole } from '@easyesg/contracts';
import { Select } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { mappingProposalQuery } from '../../queries/taxonomy-console';
import { TaxonomyRegion } from '../shared/taxonomy-region';
import { MappingEditor } from './mapping-editor';

/**
 * UC-76 on A-04 (task 67.6; FR-67; 182/39, 182/40): the pair whose mapping is open — chosen from the registered versions
 * and kept in the address — and its editor, over the mapping in force or, where none is, the api's proposal from the
 * two versions' shapes. **The editor is keyed by the pair and the revision it opened on**, so a save — or a colleague's,
 * which the api refuses this one over — remounts it with what is in force.
 */
export function MappingRegion({
  console,
  pair,
  onPairChange,
}: {
  readonly console: TaxonomyConsole;
  readonly pair: { readonly from: string; readonly to: string } | null;
  readonly onPairChange: (pair: { readonly from: string; readonly to: string }) => void;
}) {
  const t = useTranslations('platform.taxonomy.mapping');
  const versions = console.versions.map((version) => ({ value: version.version, label: version.version }));
  const stored = pair === null ? undefined : console.mappings.find((mapping) => mapping.from === pair.from && mapping.to === pair.to);
  const proposal = useQuery({ ...mappingProposalQuery(pair ?? { from: '', to: '' }), enabled: pair !== null });
  const proposed = proposal.data?.status === API_OUTCOME.Ok ? proposal.data.value : null;

  return (
    <TaxonomyRegion id="taxonomy-mapping" title={t('title')} lede={t('lede')}>
      {pair === null ? (
        <p className="t-body text-[var(--text-muted)]">{t('noPair')}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-[var(--space-4)]">
            <Select label={t('from')} value={pair.from} options={versions} onValueChange={(from) => onPairChange({ from, to: pair.to })} />
            <Select label={t('to')} value={pair.to} options={versions} onValueChange={(to) => onPairChange({ from: pair.from, to })} />
          </div>
          <MappingEditor
            key={`${pair.from}_${pair.to}_${stored?.revision ?? 0}`}
            pair={pair}
            initial={stored ?? proposed}
            revision={stored?.revision ?? 0}
            proposal={proposed}
          />
        </>
      )}
    </TaxonomyRegion>
  );
}
