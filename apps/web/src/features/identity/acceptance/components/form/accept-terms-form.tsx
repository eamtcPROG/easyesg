'use client';

import type { OwedLegalDocument } from '@easyesg/contracts';
import { LEGAL_VERSIONS_IN_FORCE } from '@easyesg/i18n';
import { Button, CALLOUT_INTENT, ExpiringCallout, Panel, useDismissible } from '@easyesg/ui';
import { FormSummary } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { acceptLegalDocumentsAction } from '../../actions/actions';
import { LegalAcceptanceCheckbox } from '../../../shared/components/legal-acceptance-checkbox';
import { SignOut } from '../../../shared/components/sign-out';
import styles from '../../../shared/styles/identity-screens.module.css';
import { ACCEPTANCE_MESSAGES } from '../shared/acceptance-messages';

/**
 * S-43's acceptance (task 195; `design_spec.md` S-43): the checkbox naming the documents owed, *Continue*, and what
 * declining comes to — the account stays as it is and reaches nothing, signing out is the way out, and closing it is a
 * request to the data-protection contact the privacy notice names (§12.5.6's task-195 row (3); FR-207).
 *
 * **It sends the versions this page displayed** — the release's, which `OwedDocuments` states above it — and the api
 * refuses them where a release has since replaced either, answered with its own three parts and a reload as the way on.
 *
 * States (§8.1 subset): rest · submitting · invalid (the box unticked, inline and in the summary) · error — recoverable
 * (the api's refusal as received) · unreachable. Success never renders: the action leaves.
 */
interface AcceptInput {
  accept: boolean;
}

export function AcceptTermsForm({
  owed,
  returnTo,
}: {
  readonly owed: readonly OwedLegalDocument[];
  readonly returnTo?: string;
}) {
  const t = useTranslations(ACCEPTANCE_MESSAGES);
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  // The account menu's own words for the same act — one sentence, wherever signing out is offered (as on S-36).
  const tAccount = useTranslations('chrome.accountMenu');
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { control, handleSubmit } = useForm<AcceptInput>({ mode: 'onTouched', defaultValues: { accept: false } });

  const submit = handleSubmit(() => {
    setFailure(null);
    startTransition(async () => {
      setFailure((await acceptLegalDocumentsAction({ legalVersions: LEGAL_VERSIONS_IN_FORCE, returnTo })) ?? null);
    });
  });

  return (
    <form method="post" onSubmit={(event) => void submit(event)} noValidate className={styles.stack}>
      <FormSummary control={control} title={tForms('summaryTitle')} />

      {shownFailure?.status === API_OUTCOME.Problem ? (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissFailure}
          title={shownFailure.problem.title ?? t('problemTitle')}
          action={null}
        >
          {shownFailure.problem.detail ?? t('problemBody')}
        </ExpiringCallout>
      ) : null}

      {shownFailure?.status === API_OUTCOME.Unreachable ? (
        <ExpiringCallout
          intent={CALLOUT_INTENT.ERROR}
          dismissLabel={tForms('closeMessage')}
          onDismiss={dismissFailure}
          title={tCommon('unreachable.title')}
          action={tCommon('unreachable.action')}
        >
          {tCommon('unreachable.body')}
        </ExpiringCallout>
      ) : null}

      <Panel className={styles.formPanel}>
        <div className={styles.fields}>
          <LegalAcceptanceCheckbox
            control={control}
            name="accept"
            documents={owed.map((document) => document.document)}
          />

          <Button type="submit" busy={pending}>
            {t('continue')}
          </Button>
        </div>
      </Panel>

      <p className={`t-body ${styles.bodyText}`}>{t('decline')}</p>
      <SignOut label={tAccount('signOut')} />
    </form>
  );
}
