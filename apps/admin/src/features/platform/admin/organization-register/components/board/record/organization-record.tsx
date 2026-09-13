import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, Panel } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'use-intl';

/**
 * An organization's account-level record (task 67.3; §5.2 A-02's *open an organization's
 * account-level record*), in a panel beside the table.
 *
 * **The boundary is a designed state, not an empty region** — §5.2's validation behaviour, and the
 * reason the callout is here rather than on the page: this is where an operator looks for more about
 * one organization, so it is where the record says what it holds, what it never holds, and what
 * reading an organization's content takes (FR-77, FR-78, D-5). **No control to request access**: that
 * arrives with A-07 (task 67.9) rather than as a button that cannot act.
 *
 * **What it shows is the row the table already holds**, re-read with nothing added — the register's
 * columns are the whole of what an account-level record is today, and a second route that could
 * publish more would be a second place for report content to leak through.
 */
export function OrganizationRecord({
  row,
  onClose,
}: {
  readonly row: OrganizationRegisterRow;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.organizations');
  const format = useFormatter();

  return (
    <aside aria-label={t('record.region')}>
      <Panel className="flex flex-col gap-[var(--space-4)] p-[var(--space-5)]">
        <h2 className="t-heading-3">{row.name}</h2>
        <dl className="t-body grid grid-cols-[auto_1fr] gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
          <dt className="text-[var(--text-muted)]">{t('record.idno')}</dt>
          <dd>{row.idno ?? t('table.idnoMissing')}</dd>
          <dt className="text-[var(--text-muted)]">{t('record.registered')}</dt>
          <dd>{format.dateTime(row.registeredAt, 'long')}</dd>
          <dt className="text-[var(--text-muted)]">{t('record.entities')}</dt>
          <dd>{format.number(row.entityCount, 'integer')}</dd>
          <dt className="text-[var(--text-muted)]">{t('record.reports')}</dt>
          <dd>{format.number(row.reportCount, 'integer')}</dd>
          <dt className="text-[var(--text-muted)]">{t('record.activity')}</dt>
          <dd>
            {row.lastSignInAt === null
              ? t('table.neverSignedIn')
              : format.dateTime(row.lastSignInAt, 'stamp')}
          </dd>
        </dl>
        <Callout intent={CALLOUT_INTENT.INFO} title={t('record.boundaryTitle')} action={null}>
          {t('record.boundaryBody')}
        </Callout>
        <div>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
            {t('record.close')}
          </Button>
        </div>
      </Panel>
    </aside>
  );
}
