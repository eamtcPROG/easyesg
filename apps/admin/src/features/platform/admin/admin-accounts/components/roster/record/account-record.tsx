import { ADMIN_ROSTER_KIND, ADMIN_STANDING, type AdminRosterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Dialog } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import type { AccountAction } from '../../../tools/account-action-state';
import { accountControlsFor } from '../../../tools/account-controls';
import { StandingChip } from '../shared/standing-chip';
import { AccountPowers } from './account-powers';

/**
 * A-08's record (task 67.4) — one account or invitation: its facts, what its realm may do, and the
 * controls its state admits (`account-controls.ts`). **A control in flight disables the rest**, so a
 * second click cannot race the first; the api decides both anyway.
 *
 * **In a dialogue over the roster since task 170** (`design_spec.md` §5.2's preamble), titled with the
 * address — it was a panel beside the table. A suspension's or a removal's question opens over it, and
 * the answer is announced inside it: `notice` is the board's, placed here while the record is open,
 * because the page beneath is covered and an announcement there would reach nobody.
 */
export function AccountRecord({
  row,
  operatorId,
  pending,
  notice,
  onControl,
  onClose,
}: {
  readonly row: AdminRosterRow;
  readonly operatorId: string;
  readonly pending: AccountAction | null;
  /** What the last action did, or why it was refused — `AccountNotice`, drawn above the facts. */
  readonly notice: ReactNode;
  readonly onControl: (action: AccountAction) => void;
  readonly onClose: () => void;
}) {
  const t = useTranslations('platform.accounts');
  const tRealm = useTranslations('realm.chrome.realm');
  const tChrome = useTranslations('chrome.dialog');
  const format = useFormatter();
  const controls = accountControlsFor({ row, operatorId });

  return (
    <Dialog
      open
      onClose={onClose}
      title={row.email}
      closeLabel={tChrome('close')}
      footer={
        <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onClose}>
          {t('record.close')}
        </Button>
      }
    >
      {notice}

      <dl className="t-body grid grid-cols-[auto_1fr] items-center gap-x-[var(--space-4)] gap-y-[var(--space-2)]">
        <dt className="text-[var(--text-muted)]">{t('record.realm')}</dt>
        <dd>{tRealm(row.role)}</dd>
        <dt className="text-[var(--text-muted)]">{t('record.state')}</dt>
        <dd>
          <StandingChip standing={row.standing} />
        </dd>
        {row.kind === ADMIN_ROSTER_KIND.ACCOUNT ? (
          <>
            <dt className="text-[var(--text-muted)]">{t('record.lastSignIn')}</dt>
            <dd>
              {row.lastSignInAt === null
                ? t('table.neverSignedIn')
                : format.dateTime(row.lastSignInAt, 'stamp')}
            </dd>
          </>
        ) : row.expiresAt === null ? null : (
          <>
            <dt className="text-[var(--text-muted)]">{t('record.expires')}</dt>
            <dd>{format.dateTime(row.expiresAt, 'stamp')}</dd>
          </>
        )}
      </dl>

      {row.standing === ADMIN_STANDING.REMOVED ? (
        <p className="t-caption text-[var(--text-body)]">{t('record.removedNote')}</p>
      ) : null}

      <AccountPowers role={row.role} />

      {controls.length === 0 ? null : (
        <div className="flex flex-wrap gap-[var(--space-3)]">
          {controls.map((control) => (
            <Button
              key={control}
              type="button"
              variant={BUTTON_VARIANT.SECONDARY}
              busy={pending?.rowId === row.id && pending.control === control}
              disabled={pending !== null}
              onClick={() => onControl({ rowId: row.id, control, email: row.email })}
            >
              {t(`controls.${control}`)}
            </Button>
          ))}
        </div>
      )}
    </Dialog>
  );
}
