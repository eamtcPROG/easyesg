import type { OrganizationRegisterRow } from '@easyesg/contracts';
import { COLUMN_ALIGN, type DataTableColumn } from '@easyesg/ui';
import { useMemo } from 'react';
import { useFormatter, useTranslations } from 'use-intl';
import { ROW_OPENS, RowActions } from '~/shared/row-actions';
import { REGISTER_COLUMN, type RegisterColumn } from '../../../tools/register-search';

/**
 * A-02's columns (task 67.3) — `design_spec.md` §5.2's content, in the order a support request reads
 * them: which organization, its IDNO, when it registered, how much of it exists, and when anyone was
 * last in it. **Nothing about what a report holds** (FR-77, D-5): the report column is a count.
 *
 * **The last column opens the record and holds the row's one action** (task 170; §5.2's preamble):
 * *Vedeți*, since the record is read-only, and ⋯ with the support-access request the record also
 * offers. The name is plain text again — until then it was the opener, a link-coloured button indented
 * past its own header, and nothing on the row said it could be opened.
 * **Every column but IDNO orders**; IDNO is searched by prefix instead, and an ordering by an
 * identifier nobody reads in sequence would be a control with no use.
 *
 * Memoised on its translators and on the two callbacks, which the board keeps stable: a fresh array each
 * render reaches `DataTable` as a changed prop, and `reactCompiler` is off (AD-9).
 */
export function useRegisterColumns({
  onOpen,
  onRequestAccess,
}: {
  readonly onOpen: (id: string) => void;
  readonly onRequestAccess: (id: string) => void;
}): readonly DataTableColumn<OrganizationRegisterRow, RegisterColumn>[] {
  const t = useTranslations('platform.organizations');
  const tChrome = useTranslations('chrome.rowActions');
  const format = useFormatter();

  return useMemo(
    () => [
      {
        key: REGISTER_COLUMN.NAME,
        header: t('table.name'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) => <span className="t-body-strong">{row.name}</span>,
      },
      {
        key: REGISTER_COLUMN.IDNO,
        header: t('table.idno'),
        cell: (row: OrganizationRegisterRow) => row.idno ?? t('table.idnoMissing'),
      },
      {
        key: REGISTER_COLUMN.REGISTERED,
        header: t('table.registered'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) => format.dateTime(row.registeredAt, 'short'),
      },
      {
        key: REGISTER_COLUMN.ENTITIES,
        header: t('table.entities'),
        sortable: true,
        align: COLUMN_ALIGN.END,
        cell: (row: OrganizationRegisterRow) => format.number(row.entityCount, 'integer'),
      },
      {
        key: REGISTER_COLUMN.REPORTS,
        header: t('table.reports'),
        sortable: true,
        align: COLUMN_ALIGN.END,
        cell: (row: OrganizationRegisterRow) => format.number(row.reportCount, 'integer'),
      },
      {
        key: REGISTER_COLUMN.ACTIVITY,
        header: t('table.activity'),
        sortable: true,
        cell: (row: OrganizationRegisterRow) =>
          row.lastSignInAt === null ? t('table.neverSignedIn') : format.dateTime(row.lastSignInAt, 'short'),
      },
      {
        key: REGISTER_COLUMN.ACTIONS,
        header: tChrome('header'),
        align: COLUMN_ALIGN.END,
        cell: (row: OrganizationRegisterRow) => (
          <RowActions
            name={row.name}
            opens={ROW_OPENS.VIEW}
            onOpen={() => onOpen(row.id)}
            items={[
              {
                key: 'request-access',
                label: t('record.requestAccessMenu'),
                onSelect: () => onRequestAccess(row.id),
              },
            ]}
          />
        ),
      },
    ],
    [t, tChrome, format, onOpen, onRequestAccess],
  );
}
