import { describe, expect, it } from 'vitest';
import { ENTITY_STATUS, MEMBERSHIP_ROLE, REPORT_STATUS, type Invitation, type ReportingPeriod } from '@easyesg/contracts';
import { toOverviewRows } from './overview';
import {
  ATTENTION_CONCERN,
  ATTENTION_ITEM_KIND,
  ATTENTION_TONE,
  ATTENTION_TONE_OF,
  attentionItems,
  filingConcern,
  invitationConcern,
} from './attention';

/**
 * S-05's attention list as the artboard draws it (task 255): what each item is about, how pressing its mark says it
 * is, and the order the two sources share. The rows' own rules — which filings are listed at all, and their order —
 * are `overview.spec.ts`'s.
 */

const CHISINAU = 'Europe/Chisinau';
const NOW = new Date('2026-09-07T12:00:00.000Z');

const aPeriod = (over: Partial<ReportingPeriod> = {}): ReportingPeriod => ({
  id: 'p1',
  reportingEntityId: 'e1',
  entityName: 'Alfa SRL',
  entityStatus: ENTITY_STATUS.ACTIVE,
  fiscalYear: 2026,
  periodStart: { date: '2026-01-01', timezone: CHISINAU },
  periodEnd: { date: '2026-12-31', timezone: CHISINAU },
  dueDate: null,
  templateVersion: '1.3.0',
  taxonomyVersion: '2026-05-01',
  priorPeriodId: null,
  entitySnapshotId: 's1',
  lockedAt: null,
  lockedBy: null,
  createdAt: 0,
  updatedAt: 0,
  report: null,
  ...over,
});

const aReport = (over: Partial<NonNullable<ReportingPeriod['report']>> = {}): NonNullable<ReportingPeriod['report']> => ({
  id: 'r1',
  status: REPORT_STATUS.OPEN,
  validation: null,
  lastActivityAt: 1_000,
  ...over,
});

const anInvitation = (over: Partial<Invitation> = {}): Invitation => ({
  id: 'i1',
  email: 'mihai@example.md',
  role: MEMBERSHIP_ROLE.EDITOR,
  issuedAt: NOW.getTime() - 86_400_000,
  expiresAt: NOW.getTime() + 6 * 86_400_000,
  ...over,
});

const rowOf = (period: ReportingPeriod) => {
  const [row] = toOverviewRows({ periods: [period], now: NOW });
  if (row === undefined) throw new Error('no row');
  return row;
};

describe('what a filing asks of the reader', () => {
  it('is a period with no report, waiting to be started', () => {
    expect(filingConcern(rowOf(aPeriod()))).toBe(ATTENTION_CONCERN.NOT_STARTED);
  });

  it('is work in progress where the last check left nothing outstanding, or none has run', () => {
    expect(filingConcern(rowOf(aPeriod({ report: aReport() })))).toBe(ATTENTION_CONCERN.IN_PROGRESS);
    expect(
      filingConcern(
        rowOf(aPeriod({ report: aReport({ validation: { modulesComplete: 4, modulesCounted: 11, outstanding: 0 } }) })),
      ),
    ).toBe(ATTENTION_CONCERN.IN_PROGRESS);
  });

  it('is answers needing a fix where the last check left any', () => {
    const row = rowOf(aPeriod({ report: aReport({ validation: { modulesComplete: 7, modulesCounted: 11, outstanding: 2 } }) }));

    expect(filingConcern(row)).toBe(ATTENTION_CONCERN.FINDINGS);
  });

  it('is ready to file once every check has passed', () => {
    expect(filingConcern(rowOf(aPeriod({ report: aReport({ status: REPORT_STATUS.READY_TO_FILE }) })))).toBe(
      ATTENTION_CONCERN.READY_TO_FILE,
    );
  });

  /** The one fact true whatever the report's state, and the one the reader can no longer wait on. */
  it('is a passed deadline above everything else about it', () => {
    const passed = { date: '2026-05-31', timezone: CHISINAU };

    expect(filingConcern(rowOf(aPeriod({ dueDate: passed })))).toBe(ATTENTION_CONCERN.OVERDUE);
    expect(
      filingConcern(
        rowOf(
          aPeriod({
            dueDate: passed,
            report: aReport({ validation: { modulesComplete: 7, modulesCounted: 11, outstanding: 2 } }),
          }),
        ),
      ),
    ).toBe(ATTENTION_CONCERN.OVERDUE);
  });
});

describe('an invitation nobody has accepted', () => {
  it('is pending while its link works, and lapsed from the moment it expires', () => {
    const now = NOW.getTime();

    expect(invitationConcern({ invitation: anInvitation({ expiresAt: now + 1 }), now })).toBe(
      ATTENTION_CONCERN.INVITATION_PENDING,
    );
    expect(invitationConcern({ invitation: anInvitation({ expiresAt: now }), now })).toBe(
      ATTENTION_CONCERN.INVITATION_LAPSED,
    );
  });
});

describe('the mark’s tone', () => {
  it('is red where the report cannot move until something is done, and calm where work is only waiting', () => {
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.OVERDUE]).toBe(ATTENTION_TONE.ERROR);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.FINDINGS]).toBe(ATTENTION_TONE.ERROR);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.NOT_STARTED]).toBe(ATTENTION_TONE.NEUTRAL);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.IN_PROGRESS]).toBe(ATTENTION_TONE.NEUTRAL);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.READY_TO_FILE]).toBe(ATTENTION_TONE.OK);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.INVITATION_PENDING]).toBe(ATTENTION_TONE.NEUTRAL);
    expect(ATTENTION_TONE_OF[ATTENTION_CONCERN.INVITATION_LAPSED]).toBe(ATTENTION_TONE.ATTENTION);
  });
});

describe('the list', () => {
  it('puts every filing before any invitation, and the invitation lapsing soonest first', () => {
    const rows = toOverviewRows({
      periods: [
        aPeriod({ id: 'later', dueDate: { date: '2027-05-31', timezone: CHISINAU } }),
        aPeriod({ id: 'sooner', dueDate: { date: '2026-12-31', timezone: CHISINAU } }),
        aPeriod({ id: 'filed', report: aReport({ status: REPORT_STATUS.FILED }) }),
      ],
      now: NOW,
    });
    const items = attentionItems({
      rows,
      invitations: [
        anInvitation({ id: 'far', expiresAt: NOW.getTime() + 9 * 86_400_000 }),
        anInvitation({ id: 'near', expiresAt: NOW.getTime() + 86_400_000 }),
      ],
      now: NOW.getTime(),
    });

    expect(
      items.map((item) => (item.kind === ATTENTION_ITEM_KIND.FILING ? item.row.periodId : item.invitation.id)),
    ).toEqual(['sooner', 'later', 'near', 'far']);
  });

  it('is empty where nothing is unsettled and nobody is invited', () => {
    const rows = toOverviewRows({
      periods: [aPeriod({ report: aReport({ status: REPORT_STATUS.FILED }) })],
      now: NOW,
    });

    expect(attentionItems({ rows, invitations: [], now: NOW.getTime() })).toEqual([]);
  });
});
