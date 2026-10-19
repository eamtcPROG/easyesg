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

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('@/shared/report-deletion-action', () => ({ deleteReportAction: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));

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

/** S-06's row ⋯ (task 192): the report opened from it, and its deletion set apart below. */
describe('ReportRowMenu', () => {
  it('opens the report from the row’s ⋯, ahead of deleting it', async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
        <ReportRowMenu row={ROW} />
      </NextIntlClientProvider>,
    );

    await user.click(
      screen.getByRole('button', { name: ro.organization.reports.deletion.menu.replace('{entity}', ROW.entityName).replace('{year}', '2025') }),
    );
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual([
      ro.organization.reports.open,
      ro.organization.reports.deletion.item,
    ]);

    await user.click(items[0]);
    expect(push).toHaveBeenCalledExactlyOnceWith(reportRoute(ROW.id));
  });
});
