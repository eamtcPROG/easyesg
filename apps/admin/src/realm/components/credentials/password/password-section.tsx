import { useMutation } from '@tanstack/react-query';
import { Button, RecordSection } from '@easyesg/ui';
import { FormCheckbox, FormPasswordField, FormSummary } from '@easyesg/ui/forms';
import { passwordMeetsPolicy } from '@easyesg/validation';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { changeAdminPassword } from '../../../queries/credentials';
import { CREDENTIALS_EVENT, CREDENTIALS_SECTION } from '../../../tools/credentials-state';
import { PasswordRequirements } from '../../shared/password-requirements';
import { useCredentials, useSectionActivity } from '../shared/credentials-context';
import { SectionNotice } from '../shared/section-notice';

interface PasswordForm {
  password: string;
  terminateOtherSessions: boolean;
}

/**
 * A-19's password section (task 151; UC-212 step one) — a new password, with OQ-51's requirements
 * shown as it is typed, and the choice to end the operator's other sessions.
 *
 * **The requirements are A-20's, shared** (`realm/components/shared/password-requirements.tsx`): the
 * policy's own evaluation, the one the api applies, so the list and the server's verdict cannot
 * disagree (§9.8). **The current password is the record's field**, not one here — S-28's lesson,
 * where a second field asked one person for one secret twice in a viewport.
 *
 * **Ending other sessions is opted into, and its help states the consequence** (UX-70): every other
 * browser the operator is signed in to asks for a sign-in again, and this one stays — FR-7's *other*.
 */
export function PasswordSection() {
  const t = useTranslations('realm.credentials.password');
  const tRecord = useTranslations('realm.credentials');
  const { authorise, settle } = useCredentials();
  const { busy, inert } = useSectionActivity(CREDENTIALS_SECTION.PASSWORD);
  const { control, handleSubmit, reset } = useForm<PasswordForm>({
    mode: 'onTouched',
    defaultValues: { password: '', terminateOtherSessions: false },
  });
  const password = useWatch({ control, name: 'password' });

  const change = useMutation({
    mutationFn: changeAdminPassword,
    onSuccess: (outcome) =>
      settle(outcome, (changed) => ({
        type: CREDENTIALS_EVENT.PASSWORD_CHANGED,
        otherSessionsTerminated: changed.otherSessionsTerminated,
      })),
    // Cleared whatever the answer: once the request is answered, the field holds either the account's
    // password or a refused candidate for it, and neither belongs in the DOM.
    onSettled: () => reset(),
  });

  const submit = handleSubmit((values) =>
    authorise(CREDENTIALS_SECTION.PASSWORD, (currentPassword) =>
      change.mutate({
        currentPassword,
        password: values.password,
        terminateOtherSessions: values.terminateOtherSessions,
      }),
    ),
  );

  return (
    <RecordSection
      id={CREDENTIALS_SECTION.PASSWORD}
      heading={t('heading')}
      description={t('description')}
    >
      <SectionNotice section={CREDENTIALS_SECTION.PASSWORD} />

      <form
        method="post"
        onSubmit={(event) => void submit(event)}
        noValidate
        className="flex flex-col gap-[var(--space-4)]"
      >
        <FormSummary control={control} title={tRecord('summaryTitle')} />

        <FormPasswordField
          control={control}
          name="password"
          label={t('label')}
          autoComplete="new-password"
          revealLabel={tRecord('show')}
          concealLabel={tRecord('hide')}
          rules={{
            required: t('missing'),
            validate: (value) => passwordMeetsPolicy(value) || t('weak'),
          }}
        />

        <PasswordRequirements password={password} />

        <FormCheckbox
          control={control}
          name="terminateOtherSessions"
          label={t('terminate')}
          help={t('terminateHelp')}
        />

        <div>
          <Button type="submit" busy={busy} disabled={inert}>
            {t('submit')}
          </Button>
        </div>
      </form>
    </RecordSection>
  );
}
