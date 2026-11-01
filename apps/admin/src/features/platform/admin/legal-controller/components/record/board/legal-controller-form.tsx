import type { LegalControllerRecord, PublishLegalControllerRequest } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import { EMAIL_SHAPE } from '~/realm/tools/email-shape';
import {
  IDNO_FIELD_VERDICT,
  idnoFieldVerdict,
  legalControllerFieldsOf,
  publicationRequestOf,
  type LegalControllerFields,
} from '../../../tools/legal-controller-fields';

/** The api's cost bounds (`PublishLegalControllerRequestDto`), restated so a person meets them before saving. */
const NAME_MAX = 300;
const ADDRESS_MAX = 500;
const EMAIL_MAX = 254;

/**
 * A-21's one group of fields (task 75; FR-205) — the four facts the legal documents state about the operator, with an
 * explicit save (§4.6's Record). **In `board/`**, because the board is its one reader (`shared-how-many-siblings`).
 *
 * **The field-level checks live here** — required, length, an email's shape — and **the IDNO's rule is the shared
 * one** (`idnoFieldVerdict`, over `@easyesg/validation`), which the api's refusal reads too. **Beside the save, what a
 * save does**: the published documents change within seconds and their version does not (`design_spec.md` A-21). Save
 * is offered once something changed, since the api refuses a save identical to what is in force.
 */
export function LegalControllerForm({
  record,
  pending,
  onSave,
}: {
  readonly record: LegalControllerRecord;
  readonly pending: boolean;
  readonly onSave: (request: PublishLegalControllerRequest) => void;
}) {
  const t = useTranslations('platform.legalController.form');
  const titleId = useId();
  const effectId = useId();
  const { control, handleSubmit, reset, formState } = useForm<LegalControllerFields>({
    mode: 'onTouched',
    defaultValues: legalControllerFieldsOf(record),
  });

  const submit = handleSubmit((fields) => onSave(publicationRequestOf({ fields, revision: record.revision })));

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-3)]">
      <h2 id={titleId} className="t-heading-3">
        {t('title')}
      </h2>

      <form method="post" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-[var(--space-4)]">
        <FormSummary control={control} title={t('summaryTitle')} />

        <FormTextField
          control={control}
          name="registeredName"
          label={t('registeredNameLabel')}
          help={t('registeredNameHelp')}
          autoComplete="organization"
          rules={{
            required: t('registeredNameMissing'),
            validate: (value) => value.trim() !== '' || t('registeredNameMissing'),
            maxLength: { value: NAME_MAX, message: t('registeredNameTooLong') },
          }}
        />

        <FormTextField
          control={control}
          name="idno"
          label={t('idnoLabel')}
          help={t('idnoHelp')}
          inputMode="numeric"
          autoComplete="off"
          rules={{
            required: t('idnoMissing'),
            validate: (value) => {
              if (value.trim() === '') return t('idnoMissing');
              const verdict = idnoFieldVerdict(value);
              if (verdict === IDNO_FIELD_VERDICT.MALFORMED) return t('idnoMalformed');
              if (verdict === IDNO_FIELD_VERDICT.CHECK_DIGIT) return t('idnoCheckDigit');
              return true;
            },
          }}
        />

        <FormTextField
          control={control}
          name="registeredAddress"
          label={t('registeredAddressLabel')}
          help={t('registeredAddressHelp')}
          autoComplete="street-address"
          rules={{
            required: t('registeredAddressMissing'),
            validate: (value) => value.trim() !== '' || t('registeredAddressMissing'),
            maxLength: { value: ADDRESS_MAX, message: t('registeredAddressTooLong') },
          }}
        />

        <FormTextField
          control={control}
          name="dataProtectionEmail"
          type="email"
          label={t('dataProtectionEmailLabel')}
          help={t('dataProtectionEmailHelp')}
          autoComplete="off"
          rules={{
            required: t('dataProtectionEmailMissing'),
            validate: (value) => EMAIL_SHAPE.test(value.trim()) || t('dataProtectionEmailMalformed'),
            maxLength: { value: EMAIL_MAX, message: t('dataProtectionEmailTooLong') },
          }}
        />

        <p id={effectId} className="t-caption text-[var(--text-muted)]">
          {t('effect')}
        </p>

        <div className="flex flex-wrap gap-[var(--space-3)]">
          <Button type="submit" busy={pending} disabled={pending || !formState.isDirty} aria-describedby={effectId}>
            {t('save')}
          </Button>
          <Button
            type="button"
            variant={BUTTON_VARIANT.SECONDARY}
            disabled={!formState.isDirty}
            onClick={() => reset(legalControllerFieldsOf(record))}
          >
            {t('reset')}
          </Button>
        </div>
      </form>
    </section>
  );
}
