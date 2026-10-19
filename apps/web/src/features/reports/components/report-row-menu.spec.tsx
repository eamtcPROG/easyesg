import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { REPORT_STATUS } from '@easyesg/contracts';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import { reportRoute } from '@/lib/routes';
import type { ReportRow } from '../tools/reports';
import { ReportRowMenu } from './report-row-menu';

const { push, saveExport } = vi.hoisted(() => ({ push: vi.fn(), saveExport: vi.fn() }));
vi.mock('@/shared/report-deletion-action', () => ({ deleteReportAction: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/client/exports/save-export', () => ({ saveExport }));

const ROW: ReportRow = {
  id: 'r1',
  entityId: 'e1',
  entityName: 'Brutăria Lina SRL',
  fiscalYear: 2025,
  start: '2025-01-01',
  end: '2025-12-31',
  due: null,
  status: REPORT_STATUS.OPEN,
  scope: 'basic',
  templateVersion: '1.3.0',
  taxonomyVersion: '2026-05-01',
  updatedAt: 1_787_000_000_000,
  validation: null,
  archived: false,
  locked: false,
  exported: false,
  filed: null,
};

const REPORTS = ro.organization.reports;
const FILED: ReportRow = {
  ...ROW,
  status: REPORT_STATUS.FILED,
  exported: true,
  filed: { filedOn: { date: '2026-05-19', timezone: 'Europe/Chisinau' }, files: 2, latestExportId: 'x2' },
};

const itemsOf = async (input: { row: ReportRow; canDownload: boolean; canDelete: boolean }) => {
  const user = userEvent.setup();
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
      <ReportRowMenu row={input.row} canDownload={input.canDownload} canDelete={input.canDelete} />
    </NextIntlClientProvider>,
  );
  await user.click(
    screen.getByRole('button', {
      name: REPORTS.menu.replace('{entity}', input.row.entityName).replace('{year}', String(input.row.fiscalYear)),
    }),
  );
  return { user, items: screen.getAllByRole('menuitem') };
};

/** S-06's row ⋯ (tasks 192, 216; 19 Oct 2026): the report opened, its latest file saved, and its deletion set apart. */
describe('ReportRowMenu', () => {
  it('opens the report from the row’s ⋯, ahead of deleting it', async () => {
    const { user, items } = await itemsOf({ row: ROW, canDownload: true, canDelete: true });
    expect(items.map((item) => item.textContent)).toEqual([REPORTS.open, REPORTS.deletion.item]);

    await user.click(items[0]);
    expect(push).toHaveBeenCalledExactlyOnceWith(reportRoute(ROW.id));
  });

  it('saves a filed row’s latest file, for an editor, by the link the pass-through serves', async () => {
    const { user, items } = await itemsOf({ row: FILED, canDownload: true, canDelete: false });
    expect(items.map((item) => item.textContent)).toEqual([REPORTS.open, REPORTS.filed.downloadLatest]);

    await user.click(items[1]);
    expect(saveExport).toHaveBeenCalledExactlyOnceWith('x2');
  });

  it('offers no download to a member who may not have the file (182/22)', async () => {
    const { items } = await itemsOf({ row: FILED, canDownload: false, canDelete: true });
    // The open and the deletion — which, the report having been exported, says why it is kept.
    expect(items).toHaveLength(2);
    expect(items.map((item) => item.textContent)).not.toContain(REPORTS.filed.downloadLatest);
  });

  it('offers no download on a row that is not filed', async () => {
    const { items } = await itemsOf({ row: ROW, canDownload: true, canDelete: false });
    expect(items.map((item) => item.textContent)).toEqual([REPORTS.open]);
  });
});
