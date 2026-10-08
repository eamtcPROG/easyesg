'use client';

import { DIALOG_SIZE, Dialog, ValidationCountBar, ValidationDock } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useRef, useState } from 'react';
import { PANEL_FILTER, panelFindings, type PanelFilter } from '../../../tools/panel-findings';
import { useValidationContext } from '../../providers/validation-context';
import { useCheckReport } from '../run/use-check-report';
import { FindingFollowContext, type FindingFollow } from '../shared/finding-follow';
import { PANEL_MESSAGES } from '../shared/panel-messages';
import { PanelBody } from './panel-body';

/**
 * **S-08, the validation panel** (task 42.2; UC-37 … UC-40; `design_spec.md` S-08 and its amendment of 8 Oct 2026) —
 * the shell's `panel` slot: docked beside the step at `wide` (`ValidationDock`), and below it a count kept in view at
 * the step's foot that raises the same panel as a sheet (`ValidationCountBar`), as *S-07/S-08 narrow* draws it.
 *
 * **The section holds what both placements share**: the run in flight (`useCheckReport`), the filter, whether the sheet
 * is open, and the findings as the panel lists them — the last run's, with each the answers held now no longer raise
 * weighed *cleared* (the step's live verdicts, through `ValidationProvider`). The three are independent — a filter, an
 * open sheet and a run move on separate events — so they are kept apart rather than in one reducer.
 *
 * **A finding followed from the sheet closes it first** (task 42.3): the sheet is modal, so while it is open its trap
 * holds focus inside it, and the field the address lands on could not take focus. The link tells the section as it is
 * followed (`FindingFollowContext`), before the browser moves to the field. **And that close alone keeps focus where
 * it lands** (task 207): a dialogue hands focus back to what opened it, which here is the count at the step's foot —
 * straight out of the field — so the section marks the close as a finding's and declines the hand-back
 * (`onCloseAutoFocus`). A ref, because it carries only the reason for the next close and nothing draws from it.
 *
 * **A Client Component because the panel is interactive throughout** — the run, the filter, the sheet — and its rows
 * read the step's live verdicts. The run it draws is read with the step on the server and held by `ValidationProvider`,
 * which verdicts the fields with it.
 */
export function ValidationSection({
  reportId,
  module,
  moduleOrder,
  mayRun,
}: {
  readonly reportId: string;
  /** The step that is open — a finding on it is followed in place (task 42.3). */
  readonly module: string;
  /** The modules the report's scope asks, in the list's order — the order the panel groups by. */
  readonly moduleOrder: readonly string[];
  readonly mayRun: boolean;
}) {
  const t = useTranslations(PANEL_MESSAGES);
  // The run the step was read with, from the provider that verdicts the fields with it — one copy across the boundary.
  const { validation, isCleared } = useValidationContext();
  const check = useCheckReport(reportId);
  const [filter, setFilter] = useState<PanelFilter>(PANEL_FILTER.ALL);
  const [sheetOpen, setSheetOpen] = useState(false);
  const followed = useRef(false);

  // Grouping a report's findings is the panel's most expensive derivation, and it feeds both placements.
  const findings = useMemo(
    () => panelFindings({ findings: validation?.findings ?? [], moduleOrder, cleared: isCleared, filter }),
    [validation, moduleOrder, isCleared, filter],
  );

  // Read by every finding's link, in both placements; its identity changes only when the sheet opens or closes.
  // The docked panel's links call it too: the sheet is closed, so nothing is marked and nothing changes.
  const onFollow = useCallback(() => {
    if (!sheetOpen) return;
    followed.current = true;
    setSheetOpen(false);
  }, [sheetOpen]);
  const follow = useMemo<FindingFollow>(() => ({ current: module, onFollow }), [module, onFollow]);
  const keepFocusWhenFollowed = useCallback((event: Event) => {
    if (!followed.current) return;
    followed.current = false;
    event.preventDefault();
  }, []);

  const body = (
    <PanelBody
      validation={validation}
      reportId={reportId}
      findings={findings}
      filter={filter}
      onFilterChange={setFilter}
      check={check}
      mayRun={mayRun}
    />
  );
  const count =
    validation === null || validation.run === null
      ? t('count.unchecked')
      : findings.counts.mustFix + findings.counts.review === 0
        ? t('count.clear')
        : t('count.findings', { mustFix: findings.counts.mustFix, review: findings.counts.review });

  return (
    <FindingFollowContext.Provider value={follow}>
      <ValidationDock>{body}</ValidationDock>
      <ValidationCountBar onOpen={() => setSheetOpen(true)} expanded={sheetOpen}>
        {count}
      </ValidationCountBar>
      <Dialog
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={t('title')}
        closeLabel={t('sheetClose')}
        size={DIALOG_SIZE.SHEET}
        onCloseAutoFocus={keepFocusWhenFollowed}
      >
        {body}
      </Dialog>
    </FindingFollowContext.Provider>
  );
}
