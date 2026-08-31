import { PeriodNotFoundError } from '@api/modules/core/period/errors/period.errors';
import { aPeriod, FakeReportingPeriodStore } from '@api/modules/core/period/testing/period.fakes';
import { ReportNotEditableError, ReportNotFoundError } from '../errors/report.errors';
import { REPORT_SCOPE, REPORT_STATUS } from '../models/report.model';
import { aReport, FakeReportStore } from '../testing/report.fakes';
import { CreateReport } from './create-report.use-case';

/**
 * UC-18 — creating the report and setting its scope (task 31.3).
 *
 * **The pin is what this spec is mostly about**, because it is the invariant the task exists to
 * prove rather than a column it happens to write. The assertions come in two kinds: the report
 * takes the *period's* versions rather than any current one, and no shape in the flow lets a caller
 * or the use case choose them. What no unit test can assert is the third guarantee — that `esg_app`
 * holds no `UPDATE` privilege on either column — which is why `schema-invariants.e2e-spec.ts` and
 * the e2e suite carry the other half.
 */

const AT = new Date('2026-09-01T10:00:00.000Z');
const now = () => AT;

const REGISTERED = '2026-05-01';
/** A period pinned to something else — a version the platform adopted later, or earlier. */
const SUPERSEDED = '2025-11-30';

const PERIOD_ID = '00000000-0000-0000-0000-0000000000c1';
const REPORT_ID = '00000000-0000-0000-0000-0000000000f1';

const build = (options: { periods?: ReturnType<typeof aPeriod>[]; reports?: ReturnType<typeof aReport>[] } = {}) => {
  const periods = options.periods ?? [aPeriod({ id: PERIOD_ID })];
  const periodStore = new FakeReportingPeriodStore(periods);
  const reportStore = new FakeReportStore(
    periods.map((period) => ({
      id: period.id,
      templateVersion: period.templateVersion,
      taxonomyVersion: period.taxonomyVersion,
    })),
    options.reports ?? [],
  );
  return { reportStore, periodStore, useCase: new CreateReport(reportStore, periodStore, now) };
};

describe('CreateReport', () => {
  describe('creating the report (UC-18)', () => {
    /**
     * **The default is applied here rather than at the edge**, so this asserts it from the command
     * the controller actually sends — one that names no scope at all. Defaulted in the DTO instead,
     * a caller reaching the use case any other way would create a report with no scope.
     */
    it('creates it open and Basic by default, against the period given', async () => {
      const { useCase } = build();

      const report = await useCase.create({ reportingPeriodId: PERIOD_ID });

      expect(report).toMatchObject({
        reportingPeriodId: PERIOD_ID,
        scope: REPORT_SCOPE.BASIC,
        status: REPORT_STATUS.OPEN,
      });
    });

    it('carries D-A’s Comprehensive scope where the caller asks for it (FR-177)', async () => {
      const { useCase } = build();

      const report = await useCase.create({
        reportingPeriodId: PERIOD_ID,
        scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
      });

      expect(report.scope).toBe(REPORT_SCOPE.BASIC_AND_COMPREHENSIVE);
    });

    /**
     * **DR-4, stated as the difference it makes.** The period was pinned to a version the platform
     * has since moved past; the report must carry *that* one. A flow re-resolving the registry
     * would answer the current adoption here and pass every assertion that only checks the two
     * strings are equal to each other — which is why the fixture makes them differ from what is
     * registered today.
     */
    it('pins from the period, not from whatever is registered now', async () => {
      const { useCase } = build({
        periods: [
          aPeriod({ id: PERIOD_ID, templateVersion: SUPERSEDED, taxonomyVersion: SUPERSEDED }),
        ],
      });

      const report = await useCase.create({
        reportingPeriodId: PERIOD_ID,
        scope: REPORT_SCOPE.BASIC,
      });

      expect(report.templateVersion).toBe(SUPERSEDED);
      expect(report.taxonomyVersion).toBe(SUPERSEDED);
      expect(report.templateVersion).not.toBe(REGISTERED);
    });

    it('refuses a period that does not exist, or belongs to another tenant', async () => {
      const { useCase } = build();

      await expect(
        useCase.create({
          reportingPeriodId: '00000000-0000-0000-0000-0000000000c9',
          scope: REPORT_SCOPE.BASIC,
        }),
      ).rejects.toBeInstanceOf(PeriodNotFoundError);
    });

    /**
     * FR-26: an editable session only where the period is open. **Not a role refusal** — this use
     * case never sees a role, which is what makes FR-22's "the lock refuses everyone" structural
     * rather than remembered (§12.5.6's task-31.2 row).
     */
    it('refuses to start a report inside a locked period', async () => {
      const { useCase } = build({
        periods: [aPeriod({ id: PERIOD_ID, lockedAt: new Date('2026-08-20T00:00:00.000Z') })],
      });

      await expect(
        useCase.create({ reportingPeriodId: PERIOD_ID, scope: REPORT_SCOPE.BASIC }),
      ).rejects.toBeInstanceOf(ReportNotEditableError);
    });
  });

  describe('changing the scope (FR-177)', () => {
    it('adds Comprehensive to a report already in progress', async () => {
      const { useCase } = build({ reports: [aReport({ id: REPORT_ID })] });

      const updated = await useCase.update({
        reportId: REPORT_ID,
        patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE },
      });

      expect(updated.scope).toBe(REPORT_SCOPE.BASIC_AND_COMPREHENSIVE);
      expect(updated.updatedAt).toEqual(AT);
    });

    /**
     * **The pin does not move on an edit, and cannot be named on one.** There is no field for it on
     * `ReportPatch`, so this asserts the consequence rather than the mechanism — the mechanism is a
     * type, and below it a privilege.
     */
    it('leaves the pinned versions exactly where they were', async () => {
      const { useCase } = build({
        reports: [
          aReport({ id: REPORT_ID, templateVersion: SUPERSEDED, taxonomyVersion: SUPERSEDED }),
        ],
      });

      const updated = await useCase.update({
        reportId: REPORT_ID,
        patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE },
      });

      expect(updated.templateVersion).toBe(SUPERSEDED);
      expect(updated.taxonomyVersion).toBe(SUPERSEDED);
    });

    it('refuses an edit to a report whose period is locked', async () => {
      const { useCase } = build({
        reports: [aReport({ id: REPORT_ID, status: REPORT_STATUS.LOCKED })],
      });

      await expect(
        useCase.update({
          reportId: REPORT_ID,
          patch: { scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE },
        }),
      ).rejects.toBeInstanceOf(ReportNotEditableError);
    });

    it('refuses a report that does not exist, or belongs to another tenant', async () => {
      const { useCase } = build();

      await expect(
        useCase.update({ reportId: REPORT_ID, patch: { scope: REPORT_SCOPE.BASIC } }),
      ).rejects.toBeInstanceOf(ReportNotFoundError);
    });
  });
});
