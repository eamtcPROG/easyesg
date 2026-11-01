import type { Validation } from '@easyesg/contracts';
import { CALLOUT_INTENT, Callout, CompletenessMeter, ValidationPanel } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { failureNotice } from '@/lib/notice';
import { CHECK_STAGE } from '../../../tools/check-state';
import type { PanelFilter, PanelFindings } from '../../../tools/panel-findings';
import { PanelGroups } from '../findings/panel-groups';
import { PanelFilters } from '../filters/panel-filters';
import { CheckReportButton } from '../run/check-report-button';
import type { CheckReport } from '../run/use-check-report';
import { PanelClear } from '../states/panel-clear';
import { PanelFiltered } from '../states/panel-filtered';
import { PanelUnchecked } from '../states/panel-unchecked';
import { PanelUnreadable } from '../states/panel-unreadable';
import { PANEL_MESSAGES } from '../shared/panel-messages';

/**
 * S-08's content (task 42.2; UC-37 … UC-40; `design_spec.md` S-08's amendment of 8 Oct 2026) — drawn once, and placed
 * twice by the section: docked beside the step at `wide`, raised as a sheet below it.
 *
 * **What it shows is the last run's** (182/26, FR-41 item 8): its counts in the completeness meter — resolved,
 * reasoned, outstanding, never a percentage — headed by when it ran, and its findings by module. **Which of §8.1's arms
 * stands in for the findings** is decided here, once: the read failed, the report was never checked, nothing is
 * outstanding, or the filter keeps none.
 *
 * **The line under the heading says what the panel is doing** — checking, sending the reporter's answers first, or when
 * it last checked — so the busy state is announced in words beside the region's `aria-busy`.
 */
export function PanelBody({
  validation,
  reportId,
  findings,
  filter,
  onFilterChange,
  check,
  mayRun,
}: {
  /** The last run as the read answered it, or `null` where the read failed. */
  readonly validation: Validation | null;
  readonly reportId: string;
  readonly findings: PanelFindings;
  readonly filter: PanelFilter;
  readonly onFilterChange: (filter: PanelFilter) => void;
  readonly check: CheckReport;
  /** An editor or the OA (182/22); a view-only member reads the panel without the control. */
  readonly mayRun: boolean;
}) {
  const t = useTranslations(PANEL_MESSAGES);
  const format = useFormatter();
  const run = validation?.run ?? null;
  const rollUp = validation?.rollUp ?? null;
  const waiting = check.stage === CHECK_STAGE.WAITING;

  const checked = check.busy
    ? t('running')
    : waiting
      ? t('sendingFirst')
      : run === null
        ? t('unchecked')
        : t('checked', { when: format.dateTime(new Date(run.evaluatedAt), 'stamp') });
  const failure =
    check.failure === null
      ? null
      : failureNotice({ outcome: check.failure, unreachable: { title: t('runFailed.title'), body: t('runFailed.body') } });

  return (
    <ValidationPanel
      title={t('title')}
      checked={checked}
      busy={check.busy}
      action={mayRun ? <CheckReportButton busy={check.busy || waiting} onPress={check.press} /> : undefined}
      meter={
        rollUp === null ? undefined : (
          <CompletenessMeter
            counts={rollUp.report}
            legend={{
              resolved: t('legend.resolved', { count: rollUp.report.resolved }),
              reasoned: t('legend.reasoned', { count: rollUp.report.reasoned }),
              outstanding: t('legend.outstanding', { count: rollUp.report.outstanding }),
            }}
          />
        )
      }
      filters={
        run === null || findings.counts.all === 0 ? undefined : (
          <PanelFilters filter={filter} counts={findings.counts} onChange={onFilterChange} />
        )
      }
    >
      {check.stage === CHECK_STAGE.STUCK ? (
        <Callout intent={CALLOUT_INTENT.WARNING} title={t('blocked.title')} action={null}>
          {t('blocked.body')}
        </Callout>
      ) : null}
      {failure === null ? null : (
        <Callout intent={failure.intent} title={failure.title} action={failure.action}>
          {failure.body}
        </Callout>
      )}
      {validation === null ? (
        <PanelUnreadable />
      ) : run === null ? (
        <PanelUnchecked mayRun={mayRun} />
      ) : findings.counts.all === 0 ? (
        <PanelClear />
      ) : findings.groups.length === 0 ? (
        <PanelFiltered />
      ) : (
        <PanelGroups reportId={reportId} groups={findings.groups} />
      )}
    </ValidationPanel>
  );
}
