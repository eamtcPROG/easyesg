import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, Panel, TextLink } from '@easyesg/ui';
import { Link } from '@tanstack/react-router';
import { useFormatter, useTranslations } from 'use-intl';
import { OrganizationMembers } from './organization-members';

/**
 * An organization's account-level record (task 67.3; §5.2 A-02's *open an organization's
 * account-level record*), in a panel beside the table.
 *
 * **The boundary is a designed state, not an empty region** — §5.2's validation behaviour, and the
 * reason the callout is here rather than on the page: this is where an operator looks for more about
 * one organization, so it is where the record says what it holds, what it never holds, and what
 * reading an organization's content takes (FR-77, FR-78, D-5). **The way to ask is beside it since task
 * 67.9**: A-07's request form, opened for this organization — which asks the organization and grants
 * nothing, so the boundary the callout states stays true after the click.
 *
 * **What it shows is the row the table already holds, and since task 167 the organization's people**
 * (`organization-members.tsx`; §12.5.6's task-167 row) — who each account belongs to and a phone where one was
 * given, one reveal at a time. That second route publishes contact data and nothing an organization reports, so the
 * boundary the callout states stays true.
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
        <OrganizationMembers organizationId={row.id} />
        <Callout
          intent={CALLOUT_INTENT.INFO}
          title={t('record.boundaryTitle')}
          action={
            <TextLink asChild>
              <Link to="/support-access" search={{ organization: row.id }}>
                {t('record.requestAccess')}
              </Link>
            </TextLink>
          }
        >
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
