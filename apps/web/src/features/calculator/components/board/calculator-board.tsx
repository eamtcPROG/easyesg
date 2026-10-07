'use client';

import type { Calculator } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useMemo, useState } from 'react';
import { useCalculator } from '@/client/calculator/use-calculator';
import { useAutosaveContext } from '@/features/wizard/components/providers/autosave-context';
import { isQueuedLine } from '@/features/wizard/tools/autosave-state';
import { reportCalculatorRoute } from '@/lib/routes';
import { computationOf } from '../../tools/computation';
import { linesOf } from '../../tools/lines';
import { AddSource } from '../adding/add-source';
import { ImportDone } from '../importing/done/import-done';
import { ImportPanel, type ImportedLines } from '../importing/section/import-panel';
import { SiteLines } from '../lines/site-lines';
import { FactorUpdateNotice } from '../notice/factor-update-notice';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { NoLines } from '../states/no-lines';
import styles from '../styles/calculator.module.css';
import { LinePager } from './line-pager';
import { SiteChips } from './site-chips';

// What stands above the lines — see the board's docblock.
const BOARD_PANEL = { ADDING: 'adding', IMPORTING: 'importing', IMPORTED: 'imported' } as const;

type BoardPanel =
  | { readonly kind: typeof BOARD_PANEL.ADDING; readonly site: number | null }
  | { readonly kind: typeof BOARD_PANEL.IMPORTING }
  | { readonly kind: typeof BOARD_PANEL.IMPORTED; readonly lines: number; readonly file: string };

/**
 * S-09's working surface (tasks 39.1, 39.2; UC-32, UC-33, UX-40 … UX-42, UX-44): UX-44's notice where a newer set is in
 * force, the site chips, *add a source*, and every line grouped by site with what it comes to — the lines the server
 * served, overlaid with what the wizard's queue has acknowledged since and with what is still waiting in it
 * (`lines.ts`), so a line entered offline is on screen the moment it is added, marked as waiting for the factors.
 *
 * **The figures are Query's** (`useCalculator`): the server's read first, then read again whenever the queue has a line
 * acknowledged, so the converted and emissions columns follow the lines. The summary beside the step reads the same key.
 *
 * **An open derivation is an address** (`?line=`, §4.7), and on a phone it is also *one source per screen*: the pager
 * says where the line stands among the shown ones and leads to the next, and the stylesheet hides the rest below the
 * narrow frame.
 *
 * **One piece of state of its own, what stands above the lines**: the add form, open at a site or from the toolbar;
 * the spreadsheet import (task 204.2; FR-211); or what an import just did. One value, because the three never stand
 * together — opening either panel is the next attempt, which clears the last import's notice (§8.1's expiring message).
 * **An import's lines go where a typed line goes**: each into the wizard's queue under a fresh id, as *Add a source*
 * puts one (§12.5.6's task-204 row (1)).
 */
export function CalculatorBoard({
  reportId,
  initial,
  shownSite,
  openLine,
  readOnly,
}: {
  readonly reportId: string;
  /** The calculator as the server read it — what the figures start from. */
  readonly initial: Calculator;
  /** The site the address shows, or `null` for all. */
  readonly shownSite: number | null;
  /** The line whose derivation the address opens, or `null`. */
  readonly openLine: string | null;
  readonly readOnly: boolean;
}) {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const { state, change } = useAutosaveContext();
  const calculator = useCalculator({ reportId, initial, committedLines: state.committedLines });
  const [panel, setPanel] = useState<BoardPanel | null>(null);
  const adding = panel?.kind === BOARD_PANEL.ADDING ? panel : null;
  const open = adding !== null || panel?.kind === BOARD_PANEL.IMPORTING;
  const startAdding = (site: number | null) => setPanel({ kind: BOARD_PANEL.ADDING, site });
  // Stable, so the memoized import panel is not re-rendered by every move of the queue: `change` and the setter are.
  const closePanel = useCallback(() => setPanel(null), []);
  const importLines = useCallback(
    ({ lines: imported, file }: ImportedLines) => {
      for (const line of imported) change({ lineId: crypto.randomUUID(), line });
      setPanel({ kind: BOARD_PANEL.IMPORTED, lines: imported.length, file });
    },
    [change],
  );

  const lines = useMemo(
    () =>
      linesOf({
        served: calculator.sources,
        committed: state.committedLines,
        pending: Object.values(state.pending)
          .sort((a, b) => a.sequence - b.sequence)
          .map((pending) => pending.write)
          .filter(isQueuedLine),
      }),
    [calculator.sources, state.committedLines, state.pending],
  );
  const sources = useMemo(
    () => new Map((calculator.factorSet?.sources ?? []).map((source) => [source.key, source])),
    [calculator.factorSet],
  );
  const computation = useMemo(() => computationOf(calculator), [calculator]);
  const sites = shownSite === null ? calculator.sites : calculator.sites.filter((site) => site.ordinal === shownSite);
  const shownLines = lines.filter((line) => sites.some((site) => site.ordinal === line.siteOrdinal));
  const focused = openLine !== null && shownLines.some((line) => line.id === openLine);
  const lineHref = (lineId: string | null) => reportCalculatorRoute({ reportId, site: shownSite, line: lineId });

  return (
    <div className={styles.board} data-focused={focused ? '' : undefined}>
      <FactorUpdateNotice reportId={reportId} calculator={calculator} readOnly={readOnly} />

      <div className={styles.toolbar}>
        <SiteChips reportId={reportId} sites={calculator.sites} lines={lines} shown={shownSite} />
        {readOnly || open ? null : (
          <div className={styles.toolbarActions}>
            {calculator.factorSet === null ? null : (
              <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => setPanel({ kind: BOARD_PANEL.IMPORTING })}>
                {t('import.open')}
              </Button>
            )}
            {lines.length === 0 ? null : (
              <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => startAdding(shownSite)}>
                {t('add.open')}
              </Button>
            )}
          </div>
        )}
      </div>

      {panel?.kind === BOARD_PANEL.IMPORTED ? (
        <ImportDone lines={panel.lines} file={panel.file} onDismiss={closePanel} />
      ) : null}

      {focused ? <LinePager lines={shownLines} open={openLine} href={lineHref} /> : null}

      {adding === null || readOnly || calculator.factorSet === null ? null : (
        <AddSource
          key={adding.site ?? 'any'}
          sources={calculator.factorSet.sources}
          sites={calculator.sites}
          site={adding.site}
          onAdd={(line) => {
            change(line);
            setPanel(null);
          }}
          onCancel={closePanel}
        />
      )}

      {panel?.kind !== BOARD_PANEL.IMPORTING || readOnly || calculator.factorSet === null ? null : (
        <ImportPanel
          sources={calculator.factorSet.sources}
          sites={calculator.sites}
          onImport={importLines}
          onCancel={closePanel}
        />
      )}

      {lines.length === 0 ? (
        open ? null : <NoLines readOnly={readOnly} onStart={() => startAdding(shownSite)} />
      ) : (
        sites.map((site) => (
          <SiteLines
            key={site.ordinal}
            site={site}
            lines={lines.filter((line) => line.siteOrdinal === site.ordinal)}
            sources={sources}
            months={calculator.months}
            readOnly={readOnly}
            onAdd={() => startAdding(site.ordinal)}
            computation={computation}
            derivation={{ open: openLine, href: lineHref }}
          />
        ))
      )}
    </div>
  );
}
