import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, REPORT_MIGRATION_STATUS, type ApiFailure, type MigrationRun } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, ConsequenceDialogue, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { retryMigrationRun, revertMigrationRun } from '../../queries/migration-runs';
import { TAXONOMY_QUERY_SCOPE } from '../../queries/taxonomy-console';
import { reportsIn, retryOffered, revertOffered, runIsMoving, shownStatuses } from '../../tools/run-progress';

/**
 * A run's heading, counts and two acts (task 67.7; UX-123): the retry of what failed, which acts on those reports alone
 * and never restarts the run, and the revert — one step back, confirmed through `ConsequenceDialogue`, which says that
 * an accepted report stays as its organization decided and that anything entered since the move is put back too.
 */
export function RunSummary({ run }: { readonly run: MigrationRun }) {
  const t = useTranslations('platform.taxonomy.run');
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const settle = async (outcome: Awaited<ReturnType<typeof retryMigrationRun>>) => {
    if (outcome.status !== API_OUTCOME.Ok) setFailure(outcome);
    await queryClient.invalidateQueries({ queryKey: TAXONOMY_QUERY_SCOPE });
  };
  const retry = useMutation({ mutationFn: retryMigrationRun, onSuccess: settle });
  const revert = useMutation({ mutationFn: revertMigrationRun, onSuccess: settle, onSettled: () => setConfirming(false) });

  return (
    <section aria-labelledby="run-heading" className="flex flex-col gap-[var(--space-4)]">
      <h1 id="run-heading" className="t-heading-2">
        {t('title', { from: run.from, to: run.to })}
      </h1>
      <p className="t-body text-[var(--text-muted)]">
        {t('started', { at: format.dateTime(new Date(run.requestedAt), 'stamp'), by: run.requestedBy ?? t('unknownOperator') })}
      </p>
      <p className="t-body">{t(`determinations.${run.determination}`)}</p>

      {run.revertedAt !== null ? (
        <Callout intent={CALLOUT_INTENT.INFO} title={t('reverted.title')} action={null}>
          {t('reverted.body', { at: format.dateTime(new Date(run.revertedAt), 'stamp') })}
        </Callout>
      ) : runIsMoving(run) ? (
        <p role="status" className="t-body">
          {t('moving', { done: run.selected - run.pending, selected: run.selected })}
        </p>
      ) : (
        <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('done.title')} action={null}>
          {t('done.body', {
            moved: reportsIn(run.tally, REPORT_MIGRATION_STATUS.MIGRATED) + reportsIn(run.tally, REPORT_MIGRATION_STATUS.AWAITING_REVIEW) + reportsIn(run.tally, REPORT_MIGRATION_STATUS.ACCEPTED),
            selected: run.selected,
            failed: reportsIn(run.tally, REPORT_MIGRATION_STATUS.FAILED),
          })}
        </Callout>
      )}

      <dl className="flex flex-wrap gap-[var(--space-6)]">
        {shownStatuses(run.tally).map((status) => (
          <div key={status}>
            <dt className="t-label">{t(`statuses.${status}`)}</dt>
            <dd className="t-heading-3">{reportsIn(run.tally, status)}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap gap-[var(--space-3)]">
        {retryOffered(run) ? (
          <Button type="button" busy={retry.isPending} onClick={() => retry.mutate(run.id)}>
            {t('retry', { failed: reportsIn(run.tally, REPORT_MIGRATION_STATUS.FAILED) })}
          </Button>
        ) : null}
        {revertOffered(run) ? (
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => setConfirming(true)}>
            {t('revert')}
          </Button>
        ) : null}
      </div>
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}

      <ConsequenceDialogue
        open={confirming}
        title={t('confirmRevert.title')}
        object={t('title', { from: run.from, to: run.to })}
        consequence={t('confirmRevert.consequence')}
        retained={t('confirmRevert.retained')}
        confirmLabel={t('confirmRevert.confirm')}
        cancelLabel={t('confirmRevert.cancel')}
        busy={revert.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => revert.mutate(run.id)}
      />
    </section>
  );
}
