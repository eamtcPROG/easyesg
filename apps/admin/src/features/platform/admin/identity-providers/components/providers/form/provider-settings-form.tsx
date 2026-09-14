import type { IdentityProvider } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { FormSummary, FormTextArea, FormTextField } from '@easyesg/ui/forms';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { PROVIDER_CONTROL, type ProviderAction } from '../../../tools/provider-action-state';
import {
  configurationRequestOf,
  settingsFieldsOf,
  type ProviderSettingsFields,
} from '../../../tools/provider-settings';

/** The api's cost bounds (`ConfigureIdentityProviderRequestDto`), restated so a person meets them before saving. */
const CLIENT_ID_MAX = 512;
const ADDRESS_MAX = 2048;

/**
 * A-18's connection group (task 67.11; UC-70) — the client id, the issuer and the redirect addresses, with an
 * explicit save (§4.6's Record). **Registering a provider is saving its first client id here**, and rotating the
 * client id is saving another.
 *
 * **Only the field-level checks live here** — required, length. Whether an issuer or an address is one the flow
 * could use is the api's judgement, from the rule its refusals come from, and arrives as a notice worded by the
 * api: a second copy of that rule in the form is what CLAUDE.md calls a second source of truth. **Save is offered
 * once something changed**, since the api refuses a save identical to what is in force.
 */
export function ProviderSettingsForm({
  provider,
  pending,
  onAction,
}: {
  readonly provider: IdentityProvider;
  readonly pending: ProviderAction | null;
  readonly onAction: (action: ProviderAction) => void;
}) {
  const t = useTranslations('platform.identityProviders.form');
  const titleId = useId();
  const { control, handleSubmit, reset, formState } = useForm<ProviderSettingsFields>({
    mode: 'onTouched',
    defaultValues: settingsFieldsOf(provider),
  });

  const submit = handleSubmit((fields) => {
    onAction({
      control: PROVIDER_CONTROL.SAVE,
      provider: provider.provider,
      request: configurationRequestOf({ fields, revision: provider.revision }),
    });
  });

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-3)]">
      <h3 id={titleId} className="t-body-strong">
        {t('title')}
      </h3>
      <p className="t-caption text-[var(--text-muted)]">{t('lede')}</p>

      <form method="post" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-[var(--space-4)]">
        <FormSummary control={control} title={t('summaryTitle')} />

        <FormTextField
          control={control}
          name="clientId"
          label={t('clientIdLabel')}
          help={t('clientIdHelp')}
          autoComplete="off"
          rules={{ maxLength: { value: CLIENT_ID_MAX, message: t('clientIdTooLong') } }}
        />

        <FormTextField
          control={control}
          name="issuer"
          label={t('issuerLabel')}
          help={t('issuerHelp')}
          autoComplete="off"
          rules={{
            required: t('issuerMissing'),
            validate: (value) => value.trim() !== '' || t('issuerMissing'),
            maxLength: { value: ADDRESS_MAX, message: t('issuerTooLong') },
          }}
        />

        <FormTextArea
          control={control}
          name="redirectUris"
          label={t('redirectLabel')}
          help={t('redirectHelp', { path: `/auth/social/${provider.provider}/callback` })}
          autoComplete="off"
        />

        <div className="flex flex-wrap gap-[var(--space-3)]">
          <Button
            type="submit"
            busy={pending?.control === PROVIDER_CONTROL.SAVE && pending.provider === provider.provider}
            disabled={pending !== null || !formState.isDirty}
          >
            {t('save')}
          </Button>
          <Button
            type="button"
            variant={BUTTON_VARIANT.SECONDARY}
            disabled={!formState.isDirty}
            onClick={() => reset(settingsFieldsOf(provider))}
          >
            {t('reset')}
          </Button>
        </div>
      </form>
    </section>
  );
}
