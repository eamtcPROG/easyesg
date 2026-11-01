'use client';

import { Button, CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import styles from './reauthentication.module.css';

/**
 * The dialogue's last stage after a recovery code (task 190; `design_spec.md` S-07's amendment of 6 Oct 2026;
 * `architecture.md` §12.5.6's task-190 row (3)) — UC-195 step 3, said before the step resumes.
 *
 * **The session is already back**; this stage only holds the dialogue open long enough to say how many codes remain.
 * *Continue* is what resumes the step, as a code from the authenticator does at once. **Managing the codes opens S-28 in
 * a new tab**, because UX-38 says the wizard is never left: the step, its queue and its dialogue stay where they are.
 *
 * The count's three readings are S-28's arrival notice's, in the dialogue's words: a number, zero as a warning that
 * says what zero means, and no number where the read failed.
 */
export function RecoveredStage({
  remaining,
  onContinue,
}: {
  readonly remaining: number | null;
  readonly onContinue: () => void;
}) {
  const t = useTranslations('identity.reauthenticate.recovered');

  return (
    <div className={styles.form}>
      {remaining === 0 ? (
        <Callout intent={CALLOUT_INTENT.WARNING} title={t('title')} action={null}>
          {t('bodyNone')}
        </Callout>
      ) : (
        <Callout intent={CALLOUT_INTENT.INFO} title={t('title')} action={null}>
          {remaining === null ? t('bodyUnread') : t('body', { remaining })}
        </Callout>
      )}
      <div className={styles.actions}>
        <Button type="button" onClick={onContinue} className={styles.action}>
          {t('continue')}
        </Button>
        <TextLink asChild>
          <Link href={ROUTES.ACCOUNT_CREDENTIALS} target="_blank" rel="noopener">
            {t('manage')}
          </Link>
        </TextLink>
      </div>
    </div>
  );
}
