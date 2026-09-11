'use client';

import { RecordSection } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { SECTION_READ } from '../tools/credentials';
import { CREDENTIALS_SECTION } from '../tools/credentials-state';
import { useCredentials } from './credentials-context';
import { FactorBody } from './factor-body';
import { SectionUnavailable } from './section-unavailable';

/**
 * S-28's second factor — UC-193, and the one section with a shape of its own.
 *
 * **Three of its states are the enrolment's two steps and the codes**, and they are the screen's
 * `stage` rather than this component's, because the reader can be *returned* into one: the codes
 * arrive from a re-issue as well as from enrolment, and both must look identical. Holding them
 * here would be two components each owning half a state machine.
 *
 * The password is required to begin, to turn off and to re-issue (§12.5.6's re-authentication
 * row) — but **not** to confirm: `begin` took it moments ago, and a current code from the secret
 * just issued is stronger evidence than a password for the thing being proved. The API decides
 * that; this section simply supplies the record's gate on the routes that carry one.
 *
 * **No outcome is read here** (28 Aug 2026). Each action says what to run and what a success
 * *means*; `perform` owns the refusal. The handlers below used to end by passing success copy to
 * `onSettled` on a branch where the outcome was provably a failure — three dead arguments, which
 * is what a signature conflating "the outcome" with "what success says" produces.
 */
export function FactorSection() {
  const t = useTranslations('identity.credentials.factor');
  const { read } = useCredentials();

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.FACTOR}
      heading={t('heading')}
      description={t('description')}
    >
      {read.factor.status === SECTION_READ.READY ? (
        <FactorBody factor={read.factor.value} />
      ) : (
        <SectionUnavailable />
      )}
    </RecordSection>
  );
}
