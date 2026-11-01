import type { AdminRosterRow } from '@easyesg/contracts';
import type { OverflowMenuItem } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';
import type { AccountAction } from '../../../tools/account-action-state';
import { accountControlsFor, controlIsDestructive } from '../../../tools/account-controls';

/**
 * A roster row's actions (task 170; `design_spec.md` §5.2's preamble) — *Vedeți*, since the record's
 * content is read-only and its lifecycle is buttons, and ⋯ holding **exactly the controls the record
 * offers for this row** (`account-controls.ts`), so every item also has its button in the record.
 *
 * **Each item takes the record's own path** (`onControl` is the board's `request`): a suspension or a
 * removal asks UX-70's question first, over the list, and the rest act at once — the menu is a shortcut
 * to the same act, never a second way of doing it. A suspension, a removal and a revoke are set apart
 * below the menu's rule; the two that open the question end in an ellipsis, in the catalogue's words.
 *
 * **A control in flight disables every item**, as it disables the record's buttons, so a second choice
 * cannot race the first; the api decides both anyway.
 */
export function RosterRowActions({
  row,
  operatorId,
  busy,
  onOpen,
  onControl,
}: {
  readonly row: AdminRosterRow;
  /** The signed-in operator — whose own account the menu, like the record, offers no ending to. */
  readonly operatorId: string;
  readonly busy: boolean;
  readonly onOpen: (id: string) => void;
  readonly onControl: (action: AccountAction) => void;
}) {
  const t = useTranslations('platform.accounts.menu');

  const items: readonly OverflowMenuItem[] = accountControlsFor({ row, operatorId }).map((control) => ({
    key: control,
    label: t(control),
    destructive: controlIsDestructive(control),
    disabled: busy,
    onSelect: () => onControl({ rowId: row.id, control, email: row.email }),
  }));

  return <RowActions name={row.email} opens={ROW_OPENS.VIEW} onOpen={() => onOpen(row.id)} items={items} />;
}
