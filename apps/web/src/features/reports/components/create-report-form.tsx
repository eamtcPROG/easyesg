'use client';

import { DEFAULT_REPORT_SCOPE, isReportScope, REPORT_SCOPE, type ReportScope } from '@easyesg/contracts';
import { Button, BUTTON_VARIANT, ExpiringCallout, RadioGroup, useDismissible } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES, reportRoute } from '@/lib/routes';
import { createReportAction } from '../actions/actions';
import styles from './reports.module.css';

/**
 * The creation flow's last two regions — how much of the standard the report covers, then confirm and go to the report
 * (UC-18, UC-192; tasks 32.3, 78.4; `design_spec.md` S-39).
 *
 * **The only Client Component on this screen.** Both choices before it — the entity and the period — are links that
 * write the address, so they are server-rendered, and `?entity=…&period=…` makes a half-made choice something the
 * reader can reload, share or come back to (UX-4). What cannot be a link is this: a create is a write, and a write
 * needs a pending state and somewhere for a refusal to land. **The scope is held here rather than in the address**,
 * S-39's own reading: it is one value with a default, so leaving loses nothing worth a bookmark.
 *
 * **Two `useState`s, and the reducer rule is why not one**: the scope and the failure never move together — choosing an
 * option writes the first, the submit and its answer the second — so they are two independent values, each with one
 * setter, not one piece of state described twice.
 */
export interface CreateReportFormProps {
  readonly periodId: string;
}

export function CreateReportForm({ periodId }: CreateReportFormProps) {
  const t = useTranslations('organization.reports.create');
  const tForms = useTranslations('forms');
  const router = useRouter();
  const scopeHeading = useId();
  const [pending, startTransition] = useTransition();
  // FR-177's default, Basic, chosen until the reader chooses otherwise (task 78.4; §12.5.6's task-182 row (9)).
  const [scope, setScope] = useState<ReportScope>(DEFAULT_REPORT_SCOPE);
  const [failure, setFailure] = useState<ApiOutcome<unknown> | null>(null);
  // Dismissed by the failure rather than the notice built from it below, which is a new object every render; the
  // refusal leaves after a while, or when closed (design_spec.md §8.1, 28 Sep 2026).
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const notice =
    shownFailure === null
      ? null
      : failureNotice({
          outcome: shownFailure,
          unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
        });

  const submit = () => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await createReportAction({ reportingPeriodId: periodId, scope });
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      // To the report itself, which resolves to the step work should start on (task 35.3's rule).
      // `push` rather than `replace`: the reader came from a list they may want back.
      router.push(reportRoute(outcome.value.id));
    });
  };

  return (
    <>
      <section className={styles.decision} aria-labelledby={scopeHeading}>
        <h2 id={scopeHeading} className={`t-heading-3 ${styles.decisionTitle}`}>
          {t('scope.title')}
        </h2>
        <p className={`t-body ${styles.decisionHint}`}>{t('scope.hint')}</p>
        {/* The two answers as §11.5's option cards (UX-9 as amended): the eleven Basic modules, or those and C1 … C9. */}
        <RadioGroup
          labelledBy={scopeHeading}
          value={scope}
          onValueChange={(value) => {
            if (isReportScope(value)) setScope(value);
          }}
          options={[
            {
              value: REPORT_SCOPE.BASIC,
              label: t('scope.basic.label'),
              description: t('scope.basic.description'),
            },
            {
              value: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
              label: t('scope.comprehensive.label'),
              description: t('scope.comprehensive.description'),
            },
          ]}
        />
      </section>
      <div className={styles.submit}>
        {notice === null ? null : (
          /* **Through `lib/notice.ts`, not composed here.** The first draft read
             `problem.title ?? …` inline and passed the body straight through, which is the copy the
             app's own rule exists to prevent — and it had already drifted: an `unreachable` outcome
             carries no problem document, so the body was `null` and the reader got a title with no
             consequence and no next step, while the `create.unreachable` copy sat unused in all three
             catalogues. The fallback belongs **per member**, which is what this helper does.

             `action` stays absent, which the helper defaults to `null`: the "what now" is the API's
             `detail`, and this screen owns no remedy that navigates. */
          <ExpiringCallout
            intent={notice.intent}
            title={notice.title}
            action={notice.action}
            dismissLabel={tForms('closeMessage')}
            onDismiss={dismissFailure}
          >
            {notice.body}
          </ExpiringCallout>
        )}

        <Button type="button" busy={pending} onClick={submit}>
          {t('submit')}
        </Button>
        <Button asChild variant={BUTTON_VARIANT.SUBTLE}>
          <Link href={ROUTES.REPORTS}>{t('cancel')}</Link>
        </Button>
      </div>
    </>
  );
}
