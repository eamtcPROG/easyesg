'use client';

import type { Calculator } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { useCalculator } from '@/client/calculator/use-calculator';
import { useAutosaveContext } from '@/features/wizard/components/providers/autosave-context';
import { isQueuedLine } from '@/features/wizard/tools/autosave-state';
import { reportCalculatorRoute } from '@/lib/routes';
import { computationOf } from '../../tools/computation';
import { linesOf } from '../../tools/lines';
import { AddSource } from '../adding/add-source';
import { SiteLines } from '../lines/site-lines';
import { FactorUpdateNotice } from '../notice/factor-update-notice';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import { NoLines } from '../states/no-lines';
import styles from '../styles/calculator.module.css';
import { LinePager } from './line-pager';
import { SiteChips } from './site-chips';

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
 * narrow frame. One piece of state of its own — whether the add form is open, and at which site — one `useState`.
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
  // `undefined` closed; `null` opened from the toolbar; an ordinal opened at that site.
  const [adding, setAdding] = useState<number | null | undefined>(undefined);

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
        {readOnly || adding !== undefined || lines.length === 0 ? null : (
          <Button variant={BUTTON_VARIANT.SECONDARY} onClick={() => setAdding(shownSite)}>
            {t('add.open')}
          </Button>
        )}
      </div>

      {focused ? <LinePager lines={shownLines} open={openLine} href={lineHref} /> : null}

      {adding === undefined || readOnly || calculator.factorSet === null ? null : (
        <AddSource
          key={adding ?? 'any'}
          sources={calculator.factorSet.sources}
          sites={calculator.sites}
          site={adding}
          onAdd={(line) => {
            change(line);
            setAdding(undefined);
          }}
          onCancel={() => setAdding(undefined)}
        />
      )}

      {lines.length === 0 ? (
        adding === undefined ? <NoLines readOnly={readOnly} onStart={() => setAdding(shownSite)} /> : null
      ) : (
        sites.map((site) => (
          <SiteLines
            key={site.ordinal}
            site={site}
            lines={lines.filter((line) => line.siteOrdinal === site.ordinal)}
            sources={sources}
            months={calculator.months}
            readOnly={readOnly}
            onAdd={() => setAdding(site.ordinal)}
            computation={computation}
            derivation={{ open: openLine, href: lineHref }}
          />
        ))
      )}
    </div>
  );
}
