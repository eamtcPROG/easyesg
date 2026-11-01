import { useMutation } from '@tanstack/react-query';
import { BUTTON_VARIANT, Button, RecordSection } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import { beginAdminReenrolment } from '../../../../queries/credentials';
import { CREDENTIALS_EVENT, CREDENTIALS_SECTION } from '../../../../tools/credentials-state';
import { useCredentials, useSectionActivity } from '../../shared/credentials-context';
import { SectionNotice } from '../../shared/section-notice';
import { FactorEnrolment } from '../enrolment/factor-enrolment';

/**
 * A-19's second-factor section (task 151; UC-212 step two) — the factor in force at rest, or a
 * re-enrolment in progress.
 *
 * **There is no "off"**: a second factor is mandatory on this surface (FR-75), so the resting arm
 * states that one is in force and offers only its replacement, where S-28 offers enabling and
 * disabling. **The factor in force keeps signing the operator in until a code from the new
 * authenticator confirms it** — the resting sentence says so, because it is what makes starting a
 * re-enrolment safe to try.
 */
export function FactorSection() {
  const t = useTranslations('realm.credentials.factor');
  const { enrolment, authorise, settle } = useCredentials();
  const { busy, inert } = useSectionActivity(CREDENTIALS_SECTION.FACTOR);

  const begin = useMutation({
    mutationFn: beginAdminReenrolment,
    onSuccess: (outcome) =>
      settle(outcome, (offer) => ({ type: CREDENTIALS_EVENT.ENROLMENT_OFFERED, offer })),
  });

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.FACTOR}
      heading={t('heading')}
      description={t('description')}
    >
      <SectionNotice section={CREDENTIALS_SECTION.FACTOR} />

      {enrolment === null ? (
        <div className="flex flex-col gap-[var(--space-4)]">
          <p className="t-body">{t('standing')}</p>
          <div>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SECONDARY}
              busy={busy}
              disabled={inert}
              onClick={() =>
                authorise(CREDENTIALS_SECTION.FACTOR, (password) => begin.mutate({ password }))
              }
            >
              {t('begin')}
            </Button>
          </div>
        </div>
      ) : (
        <FactorEnrolment offer={enrolment} />
      )}
    </RecordSection>
  );
}
