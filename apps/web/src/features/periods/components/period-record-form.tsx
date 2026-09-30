'use client';

import {
  BUTTON_VARIANT,
  Button,
  CALLOUT_INTENT,
  Callout,
  ConsequenceDialogue,
  FormErrorSummary,
  RecordShell,
  ReportingPeriodPicker,
  TextField,
  VersionPinIndicator,
  periodRangeIsOrdered,
  reportingPeriodFieldIds,
  type ReportingPeriodValue,
} from '@easyesg/ui';
import type { PeriodReopening, ReportingEntity, ReportingPeriod } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { useMemo, useReducer, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { noticeFromOutcome } from '@/lib/notice';
import { GuardedLink, LeaveGuardContext, type LeaveGuard } from '@/shared/leave-guard';
import { RecordNotice } from '@/shared/record-notice';
import { legalDate } from '@/lib/legal-date';
import { entityPeriodsRoute, periodRoute } from '@/lib/routes';
import {
  FIELD_PROBLEM,
  fieldProblems,
  fiscalYearChoices,
  missingFields,
  refusedFields,
  withCalendarYearDates,
  type FieldProblem,
  type PeriodField,
  type RequiredField,
} from '../tools/period-fields';
import {
  INITIAL_PERIOD_RECORD_STATE,
  PERIOD_DIALOGUE,
  PERIOD_RECORD_EVENT,
  PERIOD_REPORT,
  periodRecordReducer,
  periodValueDiffers,
  visibleNotice,
} from '../tools/record-state';
import {
  lockPeriodAction,
  openPeriodAction,
  reopenPeriodAction,
  updatePeriodAction,
} from '../actions/actions';
import { PeriodsBreadcrumb } from './periods-breadcrumb';
import { PERIODS_MESSAGES } from './periods-messages';
import styles from './periods.module.css';

/**
 * S-14's Record (UC-56 … UC-58) — open a period, edit its shell, lock it, reopen it.
 *
 * **Lock and reopen are designed states rather than confirmations bolted on**, which is the task
 * row's own wording and UX-71's requirement: both are irreversible-class, so each is visually and
 * verbally distinguished from saving, and each **states its compensating mechanism** before it
 * happens. Locking says reopening is the only way back and that it is recorded; reopening says the
 * record is permanent.
 *
 * **The lock is not a role gate**, so this screen never says "you may not" to an administrator — it
 * says the period is locked and names the way through (FR-22 as amended, §12.5.6's task-31.2 row).
 *
 * **S-13's way back** (project owner, 30 Sep 2026): the trail above the title and the arrow before it,
 * up to the entity's periods, **and both ask before leaving unsaved changes** — this file answers the
 * guard (`shared/leave-guard.tsx`), because it is what knows whether anything is unsaved.
 *
 * **The fiscal year is chosen from a list, and a save says which field is wrong** (project owner, 30 Sep
 * 2026). The years are the last five and the next, around Chișinău's current year, which the section
 * reads on the server; a year another period holds is listed disabled, and choosing one fills empty
 * dates with its calendar year (`tools/period-fields.ts`). A save pressed with something missing is
 * refused here, before any request, and each field then says what it lacks, with a summary above
 * them (UX-111); an overlap refusal marks the two dates beside the api's own sentence.
 *
 * State is a reducer in `record-state.ts`; the dates are one `ReportingPeriodPicker` rather than
 * four fields, because §11.5 reserves that component for exactly this screen.
 */
/** The four controls' ids, so the summary's links land on the fields the picker renders. */
const FIELD_IDS = reportingPeriodFieldIds();

/** What each required field says when a save finds it empty. */
const MISSING_MESSAGE = {
  fiscalYear: 'record.fiscalYearRequired',
  start: 'record.startRequired',
  end: 'record.endRequired',
} as const satisfies Record<RequiredField, string>;
export interface PeriodRecordFormProps {
  /** The entity the period belongs to — its id for the addresses, its name for the trail. Nothing more crosses. */
  readonly entity: Pick<ReportingEntity, 'id' | 'name'>;
  /** Absent in create mode. §4.6's Record covers both, as S-13's does. */
  readonly period?: ReportingPeriod;
  readonly reopenings: readonly PeriodReopening[];
  /** Chișinău's year, read on the server — never this browser's clock (the footer's rule). */
  readonly currentYear: number;
  /** The years the entity's periods already hold, this one's included; `fiscalYearChoices` frees its own. */
  readonly takenYears: readonly number[];
}

const toValue = (period?: ReportingPeriod): ReportingPeriodValue => ({
  fiscalYear: period ? String(period.fiscalYear) : '',
  start: period?.periodStart.date ?? '',
  end: period?.periodEnd.date ?? '',
  due: period?.dueDate?.date ?? '',
});

export function PeriodRecordForm({ entity, period, reopenings, currentYear, takenYears }: PeriodRecordFormProps) {
  const entityId = entity.id;
  const t = useTranslations(PERIODS_MESSAGES);
  const tForms = useTranslations('forms');
  const router = useRouter();
  const [, startNavigation] = useTransition();
  const [state, dispatch] = useReducer(periodRecordReducer, INITIAL_PERIOD_RECORD_STATE);
  const [value, setValue] = useState<ReportingPeriodValue>(() => toValue(period));
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);

  const locked = period?.lockedAt != null;
  const ordered = periodRangeIsOrdered(value);
  // What leaving would lose: the dates as they differ from what is stored, and a reopening's reason being written.
  const edited = periodValueDiffers(value, toValue(period));
  const dirty = edited || reason.trim() !== '';
  const title = period ? t('record.titleYear', { year: String(period.fiscalYear) }) : t('record.createTitle');

  // A year as a string, never a number ICU would group ("2 026"); a taken year says why it cannot be chosen.
  const fiscalYears = fiscalYearChoices({ currentYear, takenYears, ownYear: period?.fiscalYear }).map(
    ({ year, taken }) => ({
      value: String(year),
      label: String(year),
      disabled: taken,
      description: taken ? t('record.fiscalYearTaken') : undefined,
    }),
  );

  // One list feeds both the fields' messages and the summary, so they cannot disagree.
  const problems = fieldProblems({
    value,
    checked: state.checked,
    refused: state.report?.kind === PERIOD_REPORT.REFUSED ? state.report.fields : [],
  });
  const messageFor = (field: RequiredField, problem: FieldProblem): string => {
    if (problem === FIELD_PROBLEM.RANGE) return t('record.rangeInvalid');
    if (problem === FIELD_PROBLEM.OVERLAPS) return t('record.datesOverlap');
    return t(MISSING_MESSAGE[field]);
  };
  const fieldErrors: Partial<Record<PeriodField, string>> = Object.fromEntries(
    problems.map(({ field, problem }) => [field, messageFor(field, problem)]),
  );

  // Rebuilt only when `dirty` moves, so the links reading it do not re-render on every keystroke; `dispatch` is stable
  // by React's guarantee.
  const guard = useMemo<LeaveGuard>(
    () => ({
      holds: (href) => {
        if (!dirty) return false;
        dispatch({ type: PERIOD_RECORD_EVENT.LEAVE_REQUESTED, href });
        return true;
      },
    }),
    [dirty],
  );

  /** One translation for all four writes, through the shared helper rather than a fourth copy. */
  const settle = (outcome: Parameters<typeof noticeFromOutcome>[0]['outcome']): boolean => {
    dispatch({
      type: PERIOD_RECORD_EVENT.SETTLED,
      report: {
        kind: outcome.status === API_OUTCOME.Ok ? PERIOD_REPORT.SAVED : PERIOD_REPORT.REFUSED,
        notice: noticeFromOutcome({
          outcome,
          success: { title: t('saved.title'), body: t('saved.body') },
          unreachable: { title: t('error.unreachable.title'), body: t('error.unreachable.body') },
        }),
        fields: refusedFields(outcome),
      },
    });
    return outcome.status === API_OUTCOME.Ok;
  };

  const save = () => {
    // Refused here, and said: every field that is missing or out of order now names itself.
    if (!ordered || missingFields(value).length > 0) {
      dispatch({ type: PERIOD_RECORD_EVENT.INCOMPLETE });
      return;
    }
    dispatch({ type: PERIOD_RECORD_EVENT.SUBMITTED });
    void (async () => {
      const dates = {
        periodStart: legalDate(value.start)!,
        periodEnd: legalDate(value.end)!,
        dueDate: legalDate(value.due),
      };
      const outcome = period
        ? await updatePeriodAction({
            periodId: period.id,
            patch: { fiscalYear: Number(value.fiscalYear), ...dates },
          })
        : await openPeriodAction({
            reportingEntityId: entityId,
            fiscalYear: Number(value.fiscalYear),
            ...dates,
          });
      const ok = settle(outcome);
      // A created period gets its own address, so the reader can return to it (UX-4).
      if (ok && !period && outcome.status === API_OUTCOME.Ok) {
        const created = outcome.value;
        startNavigation(() => router.push(periodRoute({ entityId, periodId: created.id })));
      }
    })();
  };

  const lock = () => {
    if (!period) return;
    dispatch({ type: PERIOD_RECORD_EVENT.SUBMITTED });
    void (async () => settle(await lockPeriodAction({ periodId: period.id })))();
  };

  const reopen = () => {
    if (!period) return;
    if (reason.trim() === '') {
      setReasonMissing(true);
      return;
    }
    setReasonMissing(false);
    dispatch({ type: PERIOD_RECORD_EVENT.SUBMITTED });
    void (async () => {
      if (settle(await reopenPeriodAction({ periodId: period.id, reason: reason.trim() }))) {
        setReason('');
      }
    })();
  };

  return (
    <LeaveGuardContext.Provider value={guard}>
      <RecordShell
        breadcrumb={<PeriodsBreadcrumb entity={entity} record={title} linkComponent={GuardedLink} />}
        back={{ href: entityPeriodsRoute(entityId), label: t('record.back') }}
        linkComponent={GuardedLink}
        title={title}
        summary={period ? t('record.lede') : t('record.createLede')}
        actions={
          locked ? (
            <div className={styles.actions}>
              <Button
                type="button"
                variant={BUTTON_VARIANT.DESTRUCTIVE}
                onClick={() =>
                  dispatch({
                    type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
                    dialogue: PERIOD_DIALOGUE.REOPEN,
                  })
                }
              >
                {t('reopen.action')}
              </Button>
            </div>
          ) : (
            <div className={styles.actions}>
              {/* Never disabled for what is missing: a button that refuses in silence says nothing about which field
                  is wrong, and a press here names them. */}
              <Button type="button" busy={state.pending} onClick={save}>
                {period ? t('record.save') : t('record.create')}
              </Button>
              {period ? (
                <Button
                  type="button"
                  variant={BUTTON_VARIANT.DESTRUCTIVE}
                  onClick={() =>
                    dispatch({
                      type: PERIOD_RECORD_EVENT.DIALOGUE_REQUESTED,
                      dialogue: PERIOD_DIALOGUE.LOCK,
                    })
                  }
                >
                  {t('lock.action')}
                </Button>
              ) : null}
            </div>
          )
        }
      >
        {/* UX-13: a read-only state names which of the three causes applies, and names the way
            through rather than implying none exists. */}
        {locked ? (
          <Callout intent={CALLOUT_INTENT.INFO} title={t('locked.title')} action={null}>
            {t('locked.body')}
          </Callout>
        ) : null}

        {/* Derived, not stored: a success says *the record on screen is what was saved*, which stops
            being true the moment the picker differs — while a refusal stands until the next attempt
            (§8.1's Success row; the S-15 decision, applied here by task 134). */}
        <RecordNotice notice={visibleNotice(state, edited)} />

        <FormErrorSummary
          title={tForms('summaryTitle')}
          items={problems.map(({ field, problem }) => ({
            fieldId: FIELD_IDS[field],
            message: messageFor(field, problem),
          }))}
        />

        <ReportingPeriodPicker
          value={value}
          onChange={(next) => setValue((previous) => withCalendarYearDates({ previous, next }))}
          fiscalYears={fiscalYears}
          placeholders={{ fiscalYear: t('record.fiscalYearPlaceholder') }}
          errors={fieldErrors}
          disabled={locked || state.pending}
          labels={{
            fiscalYear: t('record.fiscalYear'),
            start: t('record.start'),
            end: t('record.end'),
            due: t('record.due'),
          }}
          help={{
            fiscalYear: t('record.fiscalYearHelp'),
            end: t('record.endHelp'),
            due: t('record.dueHelp'),
          }}
          rangeMessage={t('record.rangeInvalid')}
        />

        {/* DR-4 made visible — task 32.3's deliverable says it plainly: the pin is only checkable
            by a reader if it is on the screen. Absent in create mode, because nothing is pinned
            until the period exists and showing today's registration would be a guess. */}
        {period ? (
          <>
            <div className={styles.pins}>
              <VersionPinIndicator label={t('pins.taxonomy')} version={period.taxonomyVersion} />
              <VersionPinIndicator label={t('pins.template')} version={period.templateVersion} />
            </div>
            <p className="t-caption">{t('pins.help')}</p>
            <p className="t-caption">
              {period.priorPeriodId === null ? t('record.prior.none') : t('record.prior.linked')}
            </p>
          </>
        ) : null}

        {/* UX-72: an amendment must look like an amendment, so the record is on the period rather
            than behind a disclosure a reader can miss. */}
        {period ? (
          <section>
            <h2 className="t-heading-3">{t('amendments.title')}</h2>
            {reopenings.length === 0 ? (
              <p className="t-caption">{t('amendments.none')}</p>
            ) : (
              <ul className={styles.amendments}>
                {reopenings.map((entry) => (
                  <li key={entry.id} className={styles.amendment}>
                    <p className="t-label">
                      {t('amendments.entry', { at: new Date(entry.reopenedAt).toISOString().slice(0, 10) })}
                    </p>
                    <p className={`t-body ${styles.amendmentReason}`}>{entry.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {state.dialogue === PERIOD_DIALOGUE.REOPEN ? (
          <div className={styles.reopen}>
            <p className="t-body">{t('reopen.body')}</p>
            <TextField
              label={t('reopen.reasonLabel')}
              help={t('reopen.reasonHelp')}
              error={reasonMissing ? t('reopen.reasonRequired') : undefined}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <div className={styles.actions}>
              <Button type="button" busy={state.pending} onClick={reopen}>
                {t('reopen.confirm')}
              </Button>
              <Button
                type="button"
                variant={BUTTON_VARIANT.SUBTLE}
                onClick={() => dispatch({ type: PERIOD_RECORD_EVENT.DISMISSED })}
              >
                {t('reopen.cancel')}
              </Button>
            </div>
          </div>
        ) : null}
      </RecordShell>

      {period ? (
        <ConsequenceDialogue
          open={state.dialogue === PERIOD_DIALOGUE.LOCK}
          object={t('record.titleYear', { year: String(period.fiscalYear) })}
          title={t('lock.title', { year: String(period.fiscalYear) })}
          consequence={t('lock.consequence')}
          retained={`${t('lock.retained')} ${t('lock.compensating')}`}
          confirmLabel={t('lock.confirm')}
          cancelLabel={t('lock.cancel')}
          busy={state.pending}
          onConfirm={lock}
          onCancel={() => dispatch({ type: PERIOD_RECORD_EVENT.DISMISSED })}
        />
      ) : null}

      {/* Leaving with changes unsaved — S-13's question in the form layer's words. The object is the record by name,
          and what survives is what was stored, of which a new period has nothing, so its dialogue says only what is
          lost. */}
      <ConsequenceDialogue
        open={state.leaving !== null}
        object={title}
        title={tForms('record.leave.title')}
        consequence={tForms('record.leave.consequence')}
        retained={period ? tForms('record.leave.retained') : undefined}
        confirmLabel={tForms('record.leave.confirm')}
        cancelLabel={tForms('record.leave.cancel')}
        onConfirm={() => {
          if (state.leaving === null) return;
          router.push(state.leaving);
          dispatch({ type: PERIOD_RECORD_EVENT.LEAVE_CONFIRMED });
        }}
        onCancel={() => dispatch({ type: PERIOD_RECORD_EVENT.LEAVE_DISMISSED })}
      />
    </LeaveGuardContext.Provider>
  );
}
