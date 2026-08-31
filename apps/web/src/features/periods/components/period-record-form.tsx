'use client';

import {
  BUTTON_VARIANT,
  Button,
  CALLOUT_INTENT,
  Callout,
  ConsequenceDialogue,
  RecordShell,
  ReportingPeriodPicker,
  TextField,
  VersionPinIndicator,
  periodRangeIsOrdered,
  type ReportingPeriodValue,
} from '@easyesg/ui';
import type { PeriodReopening, ReportingPeriod } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { useReducer, useState, useTransition } from 'react';
import { useRouter } from '@/i18n/navigation';
import { API_OUTCOME } from '@/lib/api-outcome';
import { noticeFromOutcome } from '@/lib/notice';
import { legalDate } from '@/lib/legal-date';
import { periodRoute } from '@/lib/routes';
import {
  INITIAL_PERIOD_RECORD_STATE,
  PERIOD_DIALOGUE,
  PERIOD_RECORD_EVENT,
  periodRecordReducer,
} from '../record-state';
import {
  lockPeriodAction,
  openPeriodAction,
  reopenPeriodAction,
  updatePeriodAction,
} from '../actions';
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
 * State is a reducer in `record-state.ts`; the dates are one `ReportingPeriodPicker` rather than
 * four fields, because §11.5 reserves that component for exactly this screen.
 */
export interface PeriodRecordFormProps {
  readonly entityId: string;
  /** Absent in create mode. §4.6's Record covers both, as S-13's does. */
  readonly period?: ReportingPeriod;
  readonly reopenings: readonly PeriodReopening[];
}

const toValue = (period?: ReportingPeriod): ReportingPeriodValue => ({
  fiscalYear: period ? String(period.fiscalYear) : '',
  start: period?.periodStart.date ?? '',
  end: period?.periodEnd.date ?? '',
  due: period?.dueDate?.date ?? '',
});

export function PeriodRecordForm({ entityId, period, reopenings }: PeriodRecordFormProps) {
  const t = useTranslations('organization.periods');
  const router = useRouter();
  const [, startNavigation] = useTransition();
  const [state, dispatch] = useReducer(periodRecordReducer, INITIAL_PERIOD_RECORD_STATE);
  const [value, setValue] = useState<ReportingPeriodValue>(() => toValue(period));
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);

  const locked = period?.lockedAt != null;
  const ordered = periodRangeIsOrdered(value);
  const complete = value.fiscalYear !== '' && value.start !== '' && value.end !== '';

  /** One translation for all four writes, through the shared helper rather than a fourth copy. */
  const settle = (outcome: Parameters<typeof noticeFromOutcome>[0]['outcome']): boolean => {
    dispatch({
      type: PERIOD_RECORD_EVENT.SETTLED,
      notice: noticeFromOutcome({
        outcome,
        success: { title: t('saved.title'), body: t('saved.body') },
        unreachable: { title: t('error.unreachable.title'), body: t('error.unreachable.body') },
      }),
    });
    return outcome.status === API_OUTCOME.Ok;
  };

  const save = () => {
    if (!ordered || !complete) return;
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
    <>
      <RecordShell
        title={period ? t('record.titleYear', { year: period.fiscalYear }) : t('record.createTitle')}
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
              <Button type="button" busy={state.pending} disabled={!complete} onClick={save}>
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

        {state.notice ? (
          <Callout
            intent={state.notice.intent}
            title={state.notice.title}
            action={state.notice.action}
          >
            {state.notice.body}
          </Callout>
        ) : null}

        <ReportingPeriodPicker
          value={value}
          onChange={setValue}
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
          object={t('record.titleYear', { year: period.fiscalYear })}
          title={t('lock.title', { year: period.fiscalYear })}
          consequence={t('lock.consequence')}
          retained={`${t('lock.retained')} ${t('lock.compensating')}`}
          confirmLabel={t('lock.confirm')}
          cancelLabel={t('lock.cancel')}
          busy={state.pending}
          onConfirm={lock}
          onCancel={() => dispatch({ type: PERIOD_RECORD_EVENT.DISMISSED })}
        />
      ) : null}
    </>
  );
}
