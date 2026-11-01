import { BUTTON_VARIANT, Button, OverflowMenu, type OverflowMenuItem } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * ROW_OPENS — what the row's labelled button says it does: *edit* where the record holds something the
 * operator may change, *view* where it is read-only (`design_spec.md` §5.2's preamble, task 170).
 */
export const ROW_OPENS = {
  EDIT: 'edit',
  VIEW: 'view',
} as const;

export type RowOpens = (typeof ROW_OPENS)[keyof typeof ROW_OPENS];

/**
 * A console row's actions (task 170): the labelled button that opens the row's record, and the ⋯ menu
 * of the row's own actions beside it — every one of which the record also holds, so the menu is a
 * shortcut and never the only way (the Components sheet's overflow-menu rule).
 *
 * **Named for the row.** Every row's button reads *Vedeți* and every trigger is the same glyph, so both
 * take the row's name into their accessible name — a screen reader moving down the column hears which
 * organization, account or provider each one opens rather than the same word ten times.
 *
 * **In `shared/` on that folder's admission test**: both contexts' lists open records, and it imports
 * nothing from `features/`.
 */
export function RowActions({
  name,
  opens,
  onOpen,
  items = [],
}: {
  /** The row's own name — an organization, an address, a provider — read into both controls' names. */
  readonly name: string;
  readonly opens: RowOpens;
  readonly onOpen: () => void;
  readonly items?: readonly OverflowMenuItem[];
}) {
  const t = useTranslations('chrome.rowActions');
  // The visible word, and a name that begins with it (WCAG 2.5.3, label in name) and ends with the row.
  const edits = opens === ROW_OPENS.EDIT;

  return (
    <div className="flex items-center justify-end gap-[var(--space-3)]">
      <Button
        type="button"
        variant={BUTTON_VARIANT.SECONDARY}
        aria-label={edits ? t('editNamed', { name }) : t('viewNamed', { name })}
        onClick={onOpen}
      >
        {edits ? t('edit') : t('view')}
      </Button>
      <OverflowMenu label={t('more', { name })} items={items} />
    </div>
  );
}
