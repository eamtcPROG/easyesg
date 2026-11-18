'use client';

import type { ReviewedField } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, ConsequenceDialogue, Panel, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useCallback, useReducer } from 'react';
import { Link } from '@/i18n/navigation';
import { periodRoute, reportRoute } from '@/lib/routes';
import { keepMigratedReportAction, putReportBackAction } from '../actions/actions';
import {
  DECISION,
  DECISION_EVENT,
  DECISION_OUTCOME,
  INITIAL_DECISION,
  decisionOutcomeOf,
  decisionReducer,
  type Decision,
} from '../tools/migration-decision';
import { MigrationFields } from './migration-fields';
import { MIGRATION_MESSAGES } from './migration-messages';
import styles from './migration.module.css';

export interface MigrationReviewProps {
  readonly reportId: string;
  readonly entityId: string;
  readonly periodId: string;
  readonly entityName: string;
  /** The fiscal year, already worded as a year on the server (a year is a date, not a number). */
  readonly fiscalYear: string;
  readonly from: string;
  readonly to: string;
  /** When the report was moved, worded on the server. */
  readonly movedOn: string;
  readonly fields: readonly ReviewedField[];
}

/**
 * S-49's card (task 67.20; UC-79; 182/43): what moved and what it touches, and the two decisions — keep the new version,
 * or put the report back, the second through `ConsequenceDialogue`, which says what is discarded before it is
 * confirmed. **The decision's states are one reducer** (`migration-decision.ts`), since confirming the put-back both
 * closes the dialogue and starts the request.
 */
export function MigrationReview(props: MigrationReviewProps) {
  const t = useTranslations(MIGRATION_MESSAGES);
  const [state, dispatch] = useReducer(decisionReducer, INITIAL_DECISION);

  const decide = useCallback(
    async (decision: Decision) => {
      dispatch({ type: DECISION_EVENT.SUBMITTED, decision });
      const outcome =
        decision === DECISION.KEEP
          ? await keepMigratedReportAction({ reportId: props.reportId })
          : await putReportBackAction({ reportId: props.reportId });
      dispatch({ type: DECISION_EVENT.ANSWERED, outcome: decisionOutcomeOf({ decision, outcome }) });
    },
    [props.reportId],
  );

  const toReport = (
    <TextLink asChild>
      <Link href={reportRoute(props.reportId)}>{t('open')}</Link>
    </TextLink>
  );
  const words = { entityName: props.entityName, fiscalYear: props.fiscalYear, from: props.from, to: props.to, date: props.movedOn };

  if (state.outcome === DECISION_OUTCOME.KEPT || state.outcome === DECISION_OUTCOME.PUT_BACK) {
    const key = state.outcome === DECISION_OUTCOME.KEPT ? 'kept' : 'putBack';
    return (
      <Callout intent={CALLOUT_INTENT.SUCCESS} title={t(`outcome.${key}.title`)} action={toReport}>
        {t(`outcome.${key}.body`, words)}
      </Callout>
    );
  }
  if (state.outcome === DECISION_OUTCOME.NOTHING_TO_DECIDE) {
    return (
      <Callout intent={CALLOUT_INTENT.INFO} title={t('outcome.nothing.title')} action={toReport}>
        {t('outcome.nothing.body')}
      </Callout>
    );
  }

  return (
    <Panel className={styles.card}>
      <h1 className={`t-heading-2 ${styles.title}`}>{t('heading')}</h1>
      <p className={`t-body ${styles.lede}`}>{t('moved', words)}</p>
      <p className="t-body">{t('answersKept')}</p>

      <h2 className="t-heading-4">{t('fields.title')}</h2>
      <MigrationFields fields={props.fields} />

      {state.outcome === DECISION_OUTCOME.LOCKED ? (
        <Callout
          intent={CALLOUT_INTENT.WARNING}
          title={t('outcome.locked.title')}
          action={
            <TextLink asChild>
              <Link href={periodRoute({ entityId: props.entityId, periodId: props.periodId })}>{t('outcome.locked.action')}</Link>
            </TextLink>
          }
        >
          {t('outcome.locked.body')}
        </Callout>
      ) : state.outcome === DECISION_OUTCOME.UNREACHABLE ? (
        // The body says to try again, which the two actions below are.
        <Callout intent={CALLOUT_INTENT.ERROR} title={t('outcome.unreachable.title')} action={null}>
          {t('outcome.unreachable.body')}
        </Callout>
      ) : null}

      <h2 className="t-heading-4">{t('decide')}</h2>
      <p className={`t-body ${styles.hint}`}>{t('keep.hint')}</p>
      <p className={`t-body ${styles.hint}`}>{t('putBack.hint')}</p>
      <div className={styles.actions}>
        <Button
          variant={BUTTON_VARIANT.PRIMARY}
          disabled={state.pending !== null}
          aria-busy={state.pending === DECISION.KEEP}
          onClick={() => void decide(DECISION.KEEP)}
        >
          {t('keep.label')}
        </Button>
        <Button
          variant={BUTTON_VARIANT.SECONDARY}
          disabled={state.pending !== null}
          aria-busy={state.pending === DECISION.PUT_BACK}
          onClick={() => dispatch({ type: DECISION_EVENT.PUT_BACK_ASKED })}
        >
          {t('putBack.label')}
        </Button>
        {toReport}
      </div>

      <ConsequenceDialogue
        open={state.confirmingPutBack}
        title={t('confirm.title')}
        object={t('confirm.object', words)}
        consequence={t('confirm.consequence', words)}
        confirmLabel={t('confirm.confirm')}
        cancelLabel={t('confirm.cancel')}
        busy={state.pending !== null}
        onCancel={() => dispatch({ type: DECISION_EVENT.PUT_BACK_DISMISSED })}
        onConfirm={() => void decide(DECISION.PUT_BACK)}
      />
    </Panel>
  );
}
