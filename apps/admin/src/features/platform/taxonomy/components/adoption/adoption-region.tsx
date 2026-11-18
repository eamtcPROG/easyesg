import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure, type TaxonomyConsole } from '@easyesg/contracts';
import { Button, DataTable, DateField, Select, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { TAXONOMY_QUERY_SCOPE, adoptTaxonomyVersion } from '../../queries/taxonomy-console';
import { TaxonomyRegion } from '../shared/taxonomy-region';

/**
 * FR-66's adoption schedule on A-04 (task 67.6; 182/52): which version, with which template release, a period starting
 * on each day pins. **Only forward**: a new window opens on a day after today and after the open window's start, and its
 * compensation is another adoption — never an edit of the past, which reports already pin (UX-123's documented
 * compensation). Saved against the open window's revision, so a colleague's adoption is refused rather than overwritten.
 */
export function AdoptionRegion({ console }: { readonly console: TaxonomyConsole }) {
  const t = useTranslations('platform.taxonomy.adoption');
  const queryClient = useQueryClient();
  const open = console.adoption.find((window) => window.validTo === null);
  // The version and its template are one choice: picking another version clears the template it no longer offers.
  const [{ version, templateVersion }, setChoice] = useState({ version: '', templateVersion: '' });
  const [from, setFrom] = useState('');
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);
  const templates = console.versions.find((candidate) => candidate.version === version)?.templateVersions ?? [];

  const { mutate: adopt, isPending } = useMutation({
    mutationFn: adoptTaxonomyVersion,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY_SCOPE });
    },
  });

  return (
    <TaxonomyRegion id="taxonomy-adoption" title={t('title')} lede={t('lede')}>
      <DataTable
        caption={t('caption')}
        rows={console.adoption}
        rowKey={(row) => `${row.validFrom ?? ''}/${row.version}`}
        columns={[
          { key: 'from', header: t('columns.from'), cell: (row) => row.validFrom ?? t('always') },
          { key: 'to', header: t('columns.to'), cell: (row) => row.validTo ?? t('open') },
          { key: 'version', header: t('columns.version'), cell: (row) => row.version },
          { key: 'template', header: t('columns.template'), cell: (row) => row.templateVersion },
        ]}
      />
      <form
        method="post"
        className="flex flex-col gap-[var(--space-3)]"
        onSubmit={(event) => {
          event.preventDefault();
          setFailure(null);
          adopt({ version, templateVersion, from, expectedRevision: open?.revision ?? 0 });
        }}
      >
        <Select
          label={t('version')}
          value={version}
          onValueChange={(next) => setChoice({ version: next, templateVersion: '' })}
          options={console.versions.map((candidate) => ({ value: candidate.version, label: candidate.version }))}
        />
        <Select
          label={t('template')}
          value={templateVersion}
          onValueChange={(next) => setChoice({ version, templateVersion: next })}
          options={templates.map((template) => ({ value: template, label: template }))}
        />
        <DateField label={t('day')} help={t('dayHelp')} value={from} onChange={(event) => setFrom(event.currentTarget.value)} />
        <div>
          <Button type="submit" busy={isPending} disabled={version === '' || templateVersion === '' || from === ''}>
            {t('adopt')}
          </Button>
        </div>
      </form>
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}
    </TaxonomyRegion>
  );
}
