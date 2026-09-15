import { getTranslations } from 'next-intl/server';
import { API_OUTCOME } from '@/lib/api-outcome';
import { readAccountSetup } from '@/server/data/account-setup';
import styles from '../../../shared/styles/identity-screens.module.css';
import { SETUP_STEP, setupStepOf } from '../../tools/setup-step';
import { SETUP_MESSAGES } from '../shared/setup-messages';
import { SetupComplete } from '../states/setup-complete';
import { SetupUnavailable } from '../states/setup-unavailable';
import { ProfileStep } from '../steps/profile-step';
import { SessionPasswordStep } from '../steps/session-password-step';

/**
 * S-36's one region: the read, the step, and one surface per arm (task 155; `design_spec.md` S-36).
 *
 * **The section reads; the parts render** (`section-reads-parts-render`). The step is decided from
 * what the API says the account holds — `setupStepOf`, a pure function with its own spec — so a reload,
 * a second tab or a password set elsewhere by a reset link all land on the step actually owed. Both
 * steps take what was read, the whole setup, never a projection of it.
 *
 * `searchParams` arrives unawaited from the shell and is read here, beside the setup it is read with.
 * Its `return` is the deep link S-36 was reached with — S-03's invitation, or the address the proxy
 * turned the account away from — carried to the step that completes setup, which hands it to §4.3's
 * branch.
 */
export async function CompleteAccountSection({
  searchParams,
}: {
  readonly searchParams: Promise<{ return?: string }>;
}) {
  const [setup, t, { return: returnTo }] = await Promise.all([
    readAccountSetup(),
    getTranslations(SETUP_MESSAGES),
    searchParams,
  ]);

  const step = setup.status === API_OUTCOME.Ok ? setupStepOf(setup.value) : null;

  return (
    <>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      {setup.status !== API_OUTCOME.Ok ? (
        <SetupUnavailable failure={setup} />
      ) : step === SETUP_STEP.PASSWORD ? (
        <SessionPasswordStep setup={setup.value} returnTo={returnTo} />
      ) : step === SETUP_STEP.PROFILE ? (
        <ProfileStep setup={setup.value} returnTo={returnTo} />
      ) : (
        <SetupComplete returnTo={returnTo} />
      )}
    </>
  );
}
