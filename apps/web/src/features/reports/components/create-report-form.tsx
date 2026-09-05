'use client';

import { Button, Callout, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { API_OUTCOME, type ApiOutcome } from '@/lib/api-outcome';
import { failureNotice } from '@/lib/notice';
import { Link, useRouter } from '@/i18n/navigation';
import { ROUTES, reportRoute } from '@/lib/routes';
import { createReportAction } from '../actions';
import styles from './reports.module.css';

/**
 * The creation flow's last step — confirm, and go to the report (UC-18; task 32.3).
 *
 * **The only Client Component on this screen, and it holds one value.** Both choices before it —
 * the entity and the period — are links that write the address, so they are server-rendered, and
 * `?entity=…&period=…` makes a half-made choice something the reader can reload, share or come back
 * to (UX-4). What cannot be a link is this: a create is a write, and a write needs a pending state
 * and somewhere for a refusal to land.
 *
 * One `useState` for the failure and nothing else, which is the root rule's own carve-out: a single
 * value with a lifecycle, written by one setter on submit and again on the answer. There is no
 * second piece of state to keep consistent with it.
 */
export interface CreateReportFormProps {
  readonly periodId: string;
}

export function CreateReportForm({ periodId }: CreateReportFormProps) {
  const t = useTranslations('organization.reports.create');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiOutcome<unknown> | null>(null);

  const notice =
    failure === null
      ? null
      : failureNotice({
          outcome: failure,
          unreachable: { title: t('unreachable.title'), body: t('unreachable.body') },
        });

  const submit = () => {
    setFailure(null);
    startTransition(async () => {
      const outcome = await createReportAction({ reportingPeriodId: periodId });
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
        <Callout intent={notice.intent} title={notice.title} action={notice.action}>
          {notice.body}
        </Callout>
      )}

      <Button type="button" busy={pending} onClick={submit}>
        {t('submit')}
      </Button>
      <Button asChild variant={BUTTON_VARIANT.SUBTLE}>
        <Link href={ROUTES.REPORTS}>{t('cancel')}</Link>
      </Button>
    </div>
  );
}
