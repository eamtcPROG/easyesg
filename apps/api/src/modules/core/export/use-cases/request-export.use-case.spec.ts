import { EXPORT_FORMAT, EXPORT_STATUS } from '../constants/export.constants';
import { FakeExportHistory } from '../testing/export-history.fakes';
import { EXPORT_REQUEST_OUTCOME, RequestExport } from './request-export.use-case';

const REPORT = '00000000-0000-0000-0000-0000000000f1';
const EXPORT_ID = '00000000-0000-0000-0000-0000000000e1';

/** An export request (task 47.4; FR-44; 182/20): refused with unresolved findings until they are acknowledged. */
describe('RequestExport', () => {
  const ask = (over: { unresolvedFindings?: number; acknowledgeUnresolvedFindings?: boolean } = {}) => {
    const history = new FakeExportHistory();
    const outcome = new RequestExport(history, () => EXPORT_ID).execute({
      reportId: REPORT,
      format: EXPORT_FORMAT.XLSX,
      locale: 'ro',
      unresolvedFindings: over.unresolvedFindings ?? 0,
      acknowledgeUnresolvedFindings: over.acknowledgeUnresolvedFindings ?? false,
    });
    return { history, outcome };
  };

  it('queues a report with nothing unresolved: the record, requested, and its job, keyed by the export', async () => {
    const { history, outcome } = ask();
    const result = await outcome;
    expect(result.kind).toBe(EXPORT_REQUEST_OUTCOME.QUEUED);
    expect(result.kind === EXPORT_REQUEST_OUTCOME.QUEUED && result.export).toMatchObject({
      id: EXPORT_ID,
      format: EXPORT_FORMAT.XLSX,
      locale: 'ro',
      status: EXPORT_STATUS.REQUESTED,
      taxonomyVersion: '2026-05-01',
    });
    expect(history.jobs).toEqual([{ exportId: EXPORT_ID, format: EXPORT_FORMAT.XLSX }]);
  });

  it('refuses unresolved findings unacknowledged, writing no record and no job', async () => {
    const { history, outcome } = ask({ unresolvedFindings: 2 });
    expect(await outcome).toEqual({ kind: EXPORT_REQUEST_OUTCOME.REFUSED });
    expect(history.stored.size).toBe(0);
    expect(history.jobs).toEqual([]);
  });

  it('queues them once acknowledged', async () => {
    const { history, outcome } = ask({ unresolvedFindings: 2, acknowledgeUnresolvedFindings: true });
    expect((await outcome).kind).toBe(EXPORT_REQUEST_OUTCOME.QUEUED);
    expect(history.jobs).toHaveLength(1);
  });
});
