'use client';

import type { ApiFailure } from '@easyesg/contracts';
import { Callout, ConsequenceDialogue, type OverflowMenuItem } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { reportsAfterDeletionRoute } from '@/lib/routes';
import { deleteReportAction } from './report-deletion-action';

/** What the deletion needs to know of a report — whether it can be deleted, and how to name it. */
export interface DeletableReport {
  readonly id: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  /** Its period is locked (FR-22). */
  readonly locked: boolean;
  /** A file of it was exported or is being made (FR-53). */
  readonly exported: boolean;
}

/** The dialogue is closed, or open — with why the last confirmation failed, where it did. One value, not two. */
type DeletionState = { readonly open: false } | { readonly open: true; readonly failure: ApiFailure | null };

const DELETE_ITEM = 'delete-report';

/**
 * *Delete this report* (task 192; UC-213, FR-210; `architecture.md` §12.5.6's task-192 row (3), (4)) — the last,
 * destructive item of a report's ⋯ menu, on S-06's rows and in S-07's bar, and the consequence dialogue behind it
 * (UX-70). **The caller offers it to the Organization Administrator alone**; this draws it, disabled with its reason
 * where the period is locked or a file was exported (UX-50), and runs it.
 *
 * **A deletion lands the reader on S-06, which says so**, from either screen. **A refusal or a failure keeps the
 * dialogue open with the api's words in it** — the reader is looking there, and S-07's bar has no notice region of its
 * own; the menu's reason is what usually stops a refused deletion being asked at all, so this is a race or an outage.
 */
export function useReportDeletion(report: DeletableReport): { readonly item: OverflowMenuItem; readonly dialogue: ReactNode } {
  const t = useTranslations('organization.reports.deletion');
  const router = useRouter();
  const [state, setState] = useState<DeletionState>({ open: false });
  const [deleting, startDeleting] = useTransition();

  const confirm = useCallback(() => {
    startDeleting(async () => {
      const outcome = await deleteReportAction({ reportId: report.id });
      if (outcome.status === API_OUTCOME.Ok) {
        router.push(reportsAfterDeletionRoute());
        return;
      }
      setState({ open: true, failure: outcome });
    });
  }, [report.id, router]);

  const unavailable = report.locked ? t('unavailable.locked') : report.exported ? t('unavailable.exported') : null;
  const item: OverflowMenuItem = {
    key: DELETE_ITEM,
    label: unavailable ?? t('item'),
    destructive: true,
    disabled: unavailable !== null,
    onSelect: () => setState({ open: true, failure: null }),
  };

  const failed =
    state.open && state.failure !== null
      ? failureNotice({ outcome: state.failure, unreachable: { title: t('unreachable.title'), body: t('unreachable.body') } })
      : null;

  const dialogue = (
    <ConsequenceDialogue
      open={state.open}
      object={t('object', { entity: report.entityName, year: String(report.fiscalYear) })}
      title={t('title')}
      consequence={t('consequence')}
      retained={t('retained')}
      confirmLabel={t('confirm')}
      cancelLabel={t('cancel')}
      busy={deleting}
      failure={
        failed === null ? undefined : (
          <Callout intent={failed.intent} title={failed.title} action={failed.action}>
            {failed.body}
          </Callout>
        )
      }
      onConfirm={confirm}
      onCancel={() => setState({ open: false })}
    />
  );

  return { item, dialogue };
}
