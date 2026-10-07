'use client';

import type { CalcFactorSource, CalcSite } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import type { Computation } from '../../tools/computation';
import type { LineView } from '../../tools/lines';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';
import { LineRow } from './line-row';

/**
 * One site's lines (task 39.1): the site as B1 names it, its lines in the order they were entered, and *add a source at
 * this site* at the foot. **The grouping is the structure UX-40 asks for, not a filter view** — bills arrive per site,
 * and the artboard draws the table that way.
 */
export function SiteLines({
  site,
  lines,
  sources,
  months,
  readOnly,
  onAdd,
  computation,
  derivation,
}: {
  readonly site: CalcSite;
  readonly lines: readonly LineView[];
  /** The factor set's sources by key — what each line names. */
  readonly sources: ReadonlyMap<string, CalcFactorSource>;
  readonly months: readonly string[] | null;
  readonly readOnly: boolean;
  readonly onAdd: () => void;
  /** The figures around the lines, read once by the board (task 39.2). */
  readonly computation: Computation;
  /** The line whose derivation the address opens, and how to write an address that opens one — or closes it. */
  readonly derivation: { readonly open: string | null; readonly href: (lineId: string | null) => string };
}) {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const name = site.name ?? t('sites.unnamed', { position: site.ordinal + 1 });
  return (
    <section className={styles.site} aria-label={name}>
      <h2 className={styles.siteName}>{name}</h2>
      {lines.length === 0 ? null : (
        <>
          {/* The artboard's column heads, for the eye — each control carries its own name for a screen reader. */}
          <div className={styles.columns} aria-hidden="true">
            <span>{t('columns.source')}</span>
            <span>{t('columns.invoice')}</span>
            <span>{t('columns.converted')}</span>
            <span>{t('columns.emissions')}</span>
            <span>{t('columns.period')}</span>
          </div>
          <ul className={styles.lines}>
            {lines.map((line) => (
              <LineRow
                key={line.id}
                line={line}
                source={sources.get(line.sourceKey)}
                months={months}
                readOnly={readOnly}
                computation={computation}
                derivation={{
                  open: derivation.open === line.id,
                  openHref: derivation.href(line.id),
                  closeHref: derivation.href(null),
                }}
              />
            ))}
          </ul>
        </>
      )}
      {readOnly ? null : (
        <Button variant={BUTTON_VARIANT.SUBTLE} className={styles.addAtSite} onClick={onAdd}>
          {t('add.atSite')}
        </Button>
      )}
    </section>
  );
}
