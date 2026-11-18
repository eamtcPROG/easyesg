import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Dialog, Select, useDismissible } from '@easyesg/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { RefusalCallout } from '~/realm/components/shared/refusal-callout';
import { previewMigrationRun, startMigrationRun } from '../../queries/migration-runs';
import { TAXONOMY_QUERY_SCOPE } from '../../queries/taxonomy-console';

/**
 * UX-123 before a run starts (task 67.7; UC-78; 182/42, 182/43): the blast radius — how the pair's determination lands
 * each report, how many reports across how many organizations, and how many on the version a run leaves out as
 * read-only — stated before the confirmation, and the run started on it. **The request returns at once** and the
 * console goes to the run's page, where the worker's progress is read.
 */
export function StartRunDialog({
  pair,
  templates,
  onClose,
}: {
  readonly pair: { readonly from: string; readonly to: string };
  readonly templates: readonly string[];
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.taxonomy.start');
  const tChrome = useTranslations('chrome.dialog');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState(templates.at(-1) ?? '');
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);
  const request = { ...pair, toTemplateVersion: template };
  const preview = useQuery({
    queryKey: [...TAXONOMY_QUERY_SCOPE, 'run-preview', pair.from, pair.to, template],
    queryFn: () => previewMigrationRun(request),
    enabled: template !== '',
    staleTime: Infinity,
  });

  const { mutate: start, isPending } = useMutation({
    mutationFn: startMigrationRun,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY_SCOPE });
      await navigate({ to: '/taxonomy/runs/$runId', params: { runId: outcome.value.id } });
    },
  });

  const radius = preview.data?.status === API_OUTCOME.Ok ? preview.data.value : null;
  return (
    <Dialog
      open
      onClose={onClose}
      closeLabel={tChrome('close')}
      title={t('title', pair)}
      description={t('lede')}
      footer={
        <>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            busy={isPending}
            disabled={radius === null || radius.reports === 0}
            onClick={() => {
              setFailure(null);
              start(request);
            }}
          >
            {radius === null ? t('confirmPending') : t('confirm', { reports: radius.reports })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[var(--space-4)]">
        <Select
          label={t('template')}
          value={template}
          onValueChange={setTemplate}
          options={templates.map((candidate) => ({ value: candidate, label: candidate }))}
        />
        {preview.data !== undefined && preview.data.status !== API_OUTCOME.Ok ? (
          <RefusalCallout failure={preview.data} title={t('previewProblemTitle')} fallback={t('previewProblemBody')} />
        ) : radius === null ? (
          <p className="t-body text-[var(--text-muted)]">{t('reading')}</p>
        ) : (
          <dl className="flex flex-col gap-[var(--space-2)]">
            <div>
              <dt className="t-label">{t('determination')}</dt>
              <dd className="t-body">{t(`lands.${radius.determination}`)}</dd>
            </div>
            <div>
              <dt className="t-label">{t('reach')}</dt>
              <dd className="t-body">{t('reachValue', { reports: radius.reports, organizations: radius.organizations })}</dd>
            </div>
            <div>
              <dt className="t-label">{t('leftOut')}</dt>
              <dd className="t-body">{t('leftOutValue', { reports: radius.leftOut })}</dd>
            </div>
          </dl>
        )}
        <p className="t-body">{t('kept')}</p>
        {shownFailure === null ? null : (
          <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
        )}
      </div>
    </Dialog>
  );
}
