import { getTranslations } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { readLegalAcceptance } from '@/server/data/legal-acceptance';
import { readSession } from '@/server/session/session';
import styles from '../../../shared/styles/identity-screens.module.css';
import { OwedDocuments } from '../documents/owed-documents';
import { AcceptTermsForm } from '../form/accept-terms-form';
import { AcceptanceSettled } from '../states/acceptance-settled';
import { AcceptanceUnavailable } from '../states/acceptance-unavailable';
import { ACCEPTANCE_MESSAGES } from '../shared/acceptance-messages';

/**
 * S-43's one region: the read, and one surface per arm (task 195; `design_spec.md` S-43).
 *
 * **The section reads; the parts render** (`section-reads-parts-render`). What is owed is the api's answer — the rule
 * `AuthGuard` refuses by — so a reload, a second tab or an acceptance made elsewhere all land on what is actually owed,
 * and nothing owed is the success state rather than an empty form. The account's address is the sealed session's, the
 * *signed in as* line every screen reads from it.
 *
 * `searchParams` arrives unawaited from the shell and is read here. Its `return` is the address the api client was
 * asked for when the api refused it, or the deep link sign-in carried — handed to §4.3's branch once nothing is owed.
 */
export async function AcceptTermsSection({
  searchParams,
}: {
  readonly searchParams: Promise<{ return?: string }>;
}) {
  const [acceptance, session, t, { return: returnTo }] = await Promise.all([
    readLegalAcceptance(),
    readSession(),
    getTranslations(ACCEPTANCE_MESSAGES),
    searchParams,
  ]);

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      {session ? <p className={styles.bodyText}>{t('account', { email: session.account.email })}</p> : null}
      {acceptance.status !== API_OUTCOME.Ok ? (
        <AcceptanceUnavailable failure={acceptance} />
      ) : acceptance.value.owed.length === 0 ? (
        <AcceptanceSettled returnTo={returnTo} />
      ) : (
        <>
          <OwedDocuments owed={acceptance.value.owed} />
          <AcceptTermsForm owed={acceptance.value.owed} returnTo={returnTo} />
        </>
      )}
    </>
  );
}
