import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, COLUMN_ALIGN, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { REGISTER_COLUMN, type RegisterColumn } from '../../../tools/register-search';

/**
 * A-02's columns (task 67.3) — `design_spec.md` §5.2's content, in the order a support request reads
 * them: which organization, its IDNO, when it registered, how much of it exists, and when anyone was
 * last in it. **Nothing about what a report holds** (FR-77, D-5): the report column is a count.
 *
 * **The name opens the record**, as the one control in a row, so a keyboard user reaches a record in
 * one tab stop per row and a screen reader hears the organization's name as the control's name.
 * **Every column but IDNO orders**; IDNO is searched by prefix instead, and an ordering by an
 * identifier nobody reads in sequence would be a control with no use.
 *
 * Memoised on its translators and on `onOpen`, which the board keeps stable: a fresh array each render
 * reaches `DataTable` as a changed prop, and `reactCompiler` is off (AD-9).
 */
export function useRegisterColumns({
  onOpen,
}: {
  readonly onOpen: (id: string) => void;
}): readonly DataTableColumn<OrganizationRegisterRow, RegisterColumn>[] {
  const t = useTranslations('platform.organizations.table');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: REGISTER_COLUMN.NAME,
        header: t('name'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) => (
          <Button type="button" variant={BUTTON_VARIANT.SUBTLE} onClick={() => onOpen(row.id)}>
            {row.name}
          </Button>
        ),
      },
      {
        key: REGISTER_COLUMN.IDNO,
        header: t('idno'),
        cell: (row: OrganizationRegisterRow) => row.idno ?? t('idnoMissing'),
      },
      {
        key: REGISTER_COLUMN.REGISTERED,
        header: t('registered'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) => format.dateTime(row.registeredAt, 'short'),
      },
      {
        key: REGISTER_COLUMN.ENTITIES,
        header: t('entities'),
        sortable: true,
        align: COLUMN_ALIGN.END,
        cell: (row: OrganizationRegisterRow) => format.number(row.entityCount, 'integer'),
      },
      {
        key: REGISTER_COLUMN.REPORTS,
        header: t('reports'),
        sortable: true,
        align: COLUMN_ALIGN.END,
        cell: (row: OrganizationRegisterRow) => format.number(row.reportCount, 'integer'),
      },
      {
        key: REGISTER_COLUMN.ACTIVITY,
        header: t('activity'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) =>
          row.lastSignInAt === null ? t('neverSignedIn') : format.dateTime(row.lastSignInAt, 'short'),
      },
    ],
    [t, format, onOpen],
  );
}
