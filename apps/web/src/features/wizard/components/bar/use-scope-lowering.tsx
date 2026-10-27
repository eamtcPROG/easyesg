'use client';

import { REPORT_SCOPE, type ApiFailure } from '@easyesg/contracts';
import { Callout, ConsequenceDialogue, type OverflowMenuItem } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { reportRoute } from '@/lib/routes';
import { changeScopeAction } from '../../actions/actions';
import { moduleLabel } from '../../tools/module-words';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';

/** What lowering needs to know of a report — how to name it, and which Comprehensive modules hold answers. */
export interface LowerableReport {
  readonly id: string;
  readonly entityName: string;
  readonly fiscalYear: number;
  /** The Comprehensive modules holding an answer, by reference (`comprehensiveWithAnswers`). */
  readonly held: readonly string[];
}

/** The dialogue is closed, or open — with why the last confirmation failed, where it did. One value, not two. */
type LoweringState = { readonly open: false } | { readonly open: true; readonly failure: ApiFailure | null };

const LOWER_ITEM = 'remove-comprehensive';

/**
 * *Remove the Comprehensive Module* (task 78.3; UC-192's alternate flow; FR-177 behaviour 4; `architecture.md` §12.5.6's
 * task-182 report-authoring row (10) and its task-78 row (2)) — an item of the bar's ⋯ on a report whose scope carries
 * it, and the consequence dialogue behind it (UX-70). **The bar offers it to a reader who may write the report**, as
 * `scopeChangeOffered` decides; this draws it and runs it.
 *
 * **The dialogue names the C modules holding answers and says nothing is lost**: they are hidden, not counted and not
 * exported, and come back if the module is added again — row (10)'s whole rule, said where it is decided. The item is
 * not drawn destructive, since nothing is destroyed; the deletion below it is.
 *
 * **It lands at the report's resume point**, which the report's own address resolves to among the eleven, since the
 * step the reader stood on may be one the report no longer asks. **A refusal keeps the dialogue open with the api's
 * words**, the deletion's rule: the reader is looking there.
 */
export function useScopeLowering(report: LowerableReport): {
  readonly item: OverflowMenuItem;
  readonly dialogue: ReactNode;
} {
  const t = useTranslations(WIZARD_MESSAGES);
  const format = useFormatter();
  const router = useRouter();
  const [state, setState] = useState<LoweringState>({ open: false });
  const [lowering, startLowering] = useTransition();

  const confirm = useCallback(() => {
    startLowering(async () => {
      const outcome = await changeScopeAction({ reportId: report.id, scope: REPORT_SCOPE.BASIC });
      if (outcome.status === API_OUTCOME.Ok) {
        router.push(reportRoute(report.id));
        return;
      }
      setState({ open: true, failure: outcome });
    });
  }, [report.id, router]);

  const item: OverflowMenuItem = {
    key: LOWER_ITEM,
    label: t('bar.lowering.item'),
    onSelect: () => setState({ open: true, failure: null }),
  };

  const failed =
    state.open && state.failure !== null
      ? failureNotice({
          outcome: state.failure,
          unreachable: { title: t('bar.lowering.unreachable.title'), body: t('bar.lowering.unreachable.body') },
        })
      : null;

  const consequence =
    report.held.length === 0
      ? t('bar.lowering.consequenceNone')
      : t('bar.lowering.consequence', {
          count: report.held.length,
          modules: format.list(
            report.held.map((module) => moduleLabel(t, module)),
            'enumeration',
          ),
        });

  const dialogue = (
    <ConsequenceDialogue
      open={state.open}
      object={t('bar.lowering.object', { entity: report.entityName, year: String(report.fiscalYear) })}
      title={t('bar.lowering.title')}
      consequence={consequence}
      retained={t('bar.lowering.retained')}
      confirmLabel={t('bar.lowering.confirm')}
      cancelLabel={t('bar.lowering.cancel')}
      busy={lowering}
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
