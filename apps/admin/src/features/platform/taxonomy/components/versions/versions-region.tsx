import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure, type TaxonomyConsole } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, DataTable, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { TAXONOMY_QUERY_SCOPE, registerTaxonomyVersion } from '../../queries/taxonomy-console';
import { TaxonomyRegion } from '../shared/taxonomy-region';

/**
 * UC-75 on A-04 (task 67.6; FR-65; 182/48): the registered versions with their EFRAG template releases, and the
 * versions committed in this release and not yet registered — each registered with one press, never uploaded.
 * Registering is not adopting: no report pins a version until the schedule says so.
 */
export function VersionsRegion({ console }: { readonly console: TaxonomyConsole }) {
  const t = useTranslations('platform.taxonomy.versions');
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: register, isPending, variables } = useMutation({
    mutationFn: registerTaxonomyVersion,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY_SCOPE });
    },
  });

  return (
    <TaxonomyRegion id="taxonomy-versions" title={t('title')} lede={t('lede')}>
      <DataTable
        caption={t('caption')}
        rows={console.versions}
        rowKey={(row) => row.version}
        columns={[
          { key: 'version', header: t('columns.version'), cell: (row) => row.version },
          { key: 'templates', header: t('columns.templates'), cell: (row) => row.templateVersions.join(', ') },
        ]}
      />
      {console.candidates.length === 0 ? (
        <p className="t-body text-[var(--text-muted)]">{t('noCandidates')}</p>
      ) : (
        <ul className="flex flex-col gap-[var(--space-2)]">
          {console.candidates.map((candidate) => (
            <li key={candidate} className="flex items-center justify-between gap-[var(--space-3)]">
              <span className="t-body">{t('candidate', { version: candidate })}</span>
              <Button
                type="button"
                variant={BUTTON_VARIANT.SECONDARY}
                busy={isPending && variables === candidate}
                disabled={isPending}
                onClick={() => {
                  setFailure(null);
                  register(candidate);
                }}
              >
                {t('register')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}
    </TaxonomyRegion>
  );
}
