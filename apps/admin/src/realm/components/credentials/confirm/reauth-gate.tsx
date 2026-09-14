import { RecordSection } from '@easyesg/ui';
import { FormPasswordField } from '@easyesg/ui/forms';
import { useTranslations } from 'use-intl';
import { useCredentials } from '../shared/credentials-context';

/**
 * A-19's one current-password field (task 151) — every write above asks for it (`design_spec.md` §5.2
 * A-19, on task 27.5's rule: a route that changes a credential from behind a session must not let a
 * stolen session outlive the password its owner reaches for).
 *
 * **One field for the whole record**, S-28's lesson: a field per section asks one person for one secret
 * in three places and leaves three live credentials in the DOM. **The heading is not the field's
 * label** — it says what the field is for, and when it empties, which is the one thing a reader could
 * not otherwise predict.
 *
 * **Required, unlike S-28's**: an operator account always holds a password, so an empty field is
 * refused before a request is spent on it — `authorise` validates it and sends focus here.
 */
export function ReauthGate() {
  const t = useTranslations('realm.credentials.confirm');
  const tRecord = useTranslations('realm.credentials');
  const { control } = useCredentials();

  return (
    <RecordSection id="confirm" heading={t('heading')} description={t('help')}>
      <FormPasswordField
        control={control}
        name="password"
        label={t('label')}
        autoComplete="current-password"
        revealLabel={tRecord('show')}
        concealLabel={tRecord('hide')}
        rules={{ required: t('missing') }}
      />
    </RecordSection>
  );
}
