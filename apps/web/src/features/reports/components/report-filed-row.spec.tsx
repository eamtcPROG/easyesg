import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { REPORT_STATUS } from '@easyesg/contracts';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import type { ReportRow } from '../tools/reports';
import { ReportRowActions } from './report-row-actions';
import { ReportState } from './report-state';

// The administrator's ⋯ reaches a Server Action; no case here draws it, but its module is still imported.
vi.mock('@/shared/report-deletion-action', () => ({ deleteReportAction: vi.fn() }));
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const FILED_ON = { date: '2026-05-19', timezone: 'Europe/Chisinau' };

const ROW: ReportRow = {
  id: 'r1',
  entityId: 'e1',
  entityName: 'Brutăria Lina SRL',
  fiscalYear: 2025,
  start: '2025-01-01',
  end: '2025-12-31',
  due: null,
  status: REPORT_STATUS.FILED,
  scope: 'basic',
  templateVersion: '1.3.0',
  taxonomyVersion: '2026-05-01',
  updatedAt: 1_787_000_000_000,
  validation: null,
  archived: false,
  locked: false,
  exported: true,
  filed: { filedOn: FILED_ON, files: 2, latestExportId: 'x2' },
};

const draw = (node: ReactNode) =>
  render(
    <NextIntlClientProvider locale="ro" messages={ro} formats={formats} timeZone="Europe/Chisinau">
      {node}
    </NextIntlClientProvider>,
  );

/** S-06's filed row (task 216; `architecture.md` §12.5.6's task-216 row): its day, its files, and the latest one. */
describe('a filed row on S-06', () => {
  it('names the day it was filed as the mark records it, and counts its finished files beneath', () => {
    draw(<ReportState row={ROW} />);

    expect(screen.getByText('Depus la 19 mai 2026')).toBeInTheDocument();
    expect(screen.getByText('2 exporturi')).toBeInTheDocument();
  });

  it('counts one file in the singular', () => {
    draw(<ReportState row={{ ...ROW, filed: { filedOn: FILED_ON, files: 1, latestExportId: 'x2' } }} />);

    expect(screen.getByText('1 export')).toBeInTheDocument();
  });

  it('draws an unfiled row as its status’s word alone', () => {
    draw(<ReportState row={{ ...ROW, status: REPORT_STATUS.READY_TO_FILE, filed: null }} />);

    expect(screen.getByText('Gata de depunere')).toBeInTheDocument();
    expect(screen.queryByText(/export/u)).toBeNull();
  });

  it('downloads the latest file for an editor, by a link named for its report, through the pass-through', () => {
    draw(<ReportRowActions row={ROW} canDownload canDelete={false} />);

    const link = screen.getByRole('link', {
      name: 'Descărcați ultimul fișier exportat al raportului Brutăria Lina SRL pe 2025',
    });
    expect(link).toHaveTextContent('Descărcați');
    expect(link).toHaveAttribute('href', '/api/v1/exports/x2/file');
    expect(link).toHaveAttribute('download');
  });

  it('offers a view-only member no download, the file being refused them (182/22)', () => {
    draw(<ReportRowActions row={ROW} canDownload={false} canDelete={false} />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('offers no download on a row that is not filed', () => {
    draw(<ReportRowActions row={{ ...ROW, status: REPORT_STATUS.READY_TO_FILE, filed: null }} canDownload canDelete={false} />);

    expect(screen.queryByRole('link')).toBeNull();
  });
});
