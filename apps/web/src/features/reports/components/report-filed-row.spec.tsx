import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { REPORT_STATUS } from '@easyesg/contracts';
import ro from '@/messages/ro.json';
import { formats } from '@/i18n/formats';
import type { ReportRow } from '../tools/reports';
import { ReportState } from './report-state';


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

/**
 * S-06's filed row (task 216; `architecture.md` §12.5.6's task-216 row): its day and its files. Its latest file is the
 * row ⋯'s since 19 Oct 2026, and `report-row-menu.spec.tsx` holds it.
 */
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
});
