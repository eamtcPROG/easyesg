'use client';

import { Button, BUTTON_VARIANT, Callout, CALLOUT_INTENT, RecordSection, RecordShell } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { validateIdno, validateLei } from '@easyesg/validation';
import { useFormatter, useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { Organization, UpdateOrganizationRequest } from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { updateOrganizationProfileAction } from '../actions';
import styles from './organization-profile.module.css';

/**
 * S-15's body — UC-50 and UC-51 on the Record archetype (FR-15, FR-16).
 *
 * **One form over four sections, with one save**, which is the difference from S-28. That screen's
 * sections each commit their own thing because each is a separate credential operation; here §5's
 * Controls row is *edit; save; cancel* for the record, and the artboard draws a single
 * Discard/Save pair at the foot. So `RecordShell`'s `actions` slot carries them and the sections
 * are grouping, not scope.
 *
 * **Save is inert until a field differs**, which the artboard states in words — *"Nothing changed
 * yet"*. `formState.isDirty` is what react-hook-form computes against `defaultValues`, so the
 * screen re-seeds them from the API's answer after every successful save: the API normalises (a
 * trimmed name, an upper-cased country and LEI), and a form left holding what the reader typed
 * would show a permanently dirty field they cannot clean.
 *
 * **The identifier rules come from `@easyesg/validation`, not from a regular expression here**
 * (§9.8). The same functions the API re-validates with, which is the whole reason that package
 * exists — and they separate *shape* from *check digits* because the two have different
 * resolutions, so NFR-79's "what now" can say *retype it* or *check you copied the right one*
 * rather than one unhelpful sentence.
 *
 * **Every value the API stores is a key and every label is the catalogue's** (OQ-43): the legal
 * forms and the countries arrive as `srl` and `MD`, and a key rendered raw is an internal
 * identifier on a screen. A form registered ahead of its wording renders its key, which is the
 * stated trade rather than an accident.
 *
 * States (§5's list, from §8.1): **loading — initial** is the page's · **loading — refresh** is the
 * busy save, which leaves every value readable · **error — recoverable** is the API's problem
 * document as received · **success** re-seeds and says so · **error — permission** is the page's,
 * because the refusal decides whether this renders at all · **read-only** has no cause at MVP —
 * every reader who reaches this screen is its administrator, and UX-13 requires a state to name
 * which of three causes applies, which is not a sentence that can be written yet.
 */
/**
 * A vocabulary entry: the key the API stores, and the word the reader sees.
 *
 * **Resolved by the page, not here**, which is forced rather than chosen — S-04's own page records
 * the reasoning at length. The app's `IntlMessages` augmentation narrows a namespace's keys to the
 * ones authored, so `t(countryCode)` cannot take a value the API supplies; casting would assert
 * that configuration only ever holds what this catalogue happens to know, which is the opposite of
 * what AD-4 makes true. The page indexes the catalogue object and falls back to the key, which is
 * OQ-43's stated behaviour for a value registered ahead of its wording.
 */
export interface VocabularyOption {
  readonly value: string;
  readonly label: string;
}

export interface OrganizationProfileFormProps {
  readonly organization: Organization;
  /** Each country the platform operates in, labelled, with its own labelled legal forms. */
  readonly countries: readonly (VocabularyOption & {
    readonly legalForms: readonly VocabularyOption[];
  })[];
}

/**
 * The form's own shape. **Every field is a string, including the ones the API models as nullable**
 * — an input has no null, and `''` is what "the reader cleared it" looks like in a DOM. The
 * conversion back to `null` happens once, on submit, so nothing downstream has to know.
 */
interface ProfileFields {
  name: string;
  countryCode: string;
  legalForm: string;
  idno: string;
  lei: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredLocality: string;
  registeredPostalCode: string;
  contactEmail: string;
  contactPhone: string;
  reportContactName: string;
  reportContactEmail: string;
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `null` clears a field on the API; `''` is not a value it accepts for any of them. */
const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

const toFields = (organization: Organization): ProfileFields => ({
  name: organization.name,
  countryCode: organization.countryCode,
  legalForm: organization.legalForm ?? '',
  idno: organization.idno ?? '',
  lei: organization.lei ?? '',
  registeredAddressLine1: organization.registeredAddressLine1 ?? '',
  registeredAddressLine2: organization.registeredAddressLine2 ?? '',
  registeredLocality: organization.registeredLocality ?? '',
  registeredPostalCode: organization.registeredPostalCode ?? '',
  contactEmail: organization.contactEmail ?? '',
  contactPhone: organization.contactPhone ?? '',
  reportContactName: organization.reportContactName ?? '',
  reportContactEmail: organization.reportContactEmail ?? '',
});


/**
 * FR-15's attribution line — who last changed the record, and when.
 *
 * **A top-level component, not a closure inside the form** (`rerender-no-inline-components`): a
 * component declared during render is a new type on every render, so React unmounts and remounts
 * its subtree rather than updating it. Here that is one line of text and costs nothing measurable
 * — which is precisely why it is worth fixing as a habit rather than after a profiler says so.
 *
 * **Three sentences for three states**, because "nobody has changed it" and "we cannot say who
 * did" are different facts: `lastChange` is null when the trail holds nothing for this record, and
 * its `email` is null when the acting account has since been erased — the trail carries no foreign
 * key by design, so an attribution outlives the person it names (NFR-28). Neither is an error and
 * neither may be rendered as one.
 *
 * The moment is the catalogue's `stamp` format, whose own declaration names audit surfaces as its
 * consumers — a date and a time, from the active locale, with no pattern written here (NFR-26).
 *
 * **The *history* link the artboard draws is absent.** S-12 is task 84, appended when this screen
 * went looking for its owner and found none; a link to nothing is worse than no link.
 */
function ProfileAttribution({
  lastChange,
}: {
  readonly lastChange: Organization['lastChange'];
}) {
  const t = useTranslations('organization.profile');
  const format = useFormatter();

  if (lastChange === null) return <>{t('attribution.unknown')}</>;

  const at = format.dateTime(new Date(lastChange.at), 'stamp');
  return (
    <>
      {lastChange.email
        ? t('attribution.by', { email: lastChange.email, at })
        : t('attribution.anonymous', { at })}
    </>
  );
}

export function OrganizationProfileForm({
  organization,
  countries,
}: OrganizationProfileFormProps) {
  const t = useTranslations('organization.profile');
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');

  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [current, setCurrent] = useState(organization);

  const { control, handleSubmit, reset, formState } = useForm<ProfileFields>({
    mode: 'onTouched',
    defaultValues: toFields(organization),
  });

  // **There is deliberately no effect re-seeding this from the `organization` prop.** It was
  // written and removed: `react-hooks/set-state-in-effect` flagged it, and the rule was right
  // twice over. The case it guarded — the server re-rendering a newer record under a form that is
  // still mounted — is not one this screen produces: a save resets from its own response two
  // handlers below, and any other route to a newer record (a navigation, a reload) remounts this
  // component and re-runs `defaultValues`. And the cure was worse than the disease in the one case
  // it would have fired, since resetting a form somebody is typing in discards their work, which
  // is why it carried an `isDirty` guard that made it fire almost never.
  // The legal forms of the country currently CHOSEN, not the one stored: the API re-checks the form
  // against the country the patch results in and refuses a move that would strand it, so offering
  // the old country's forms after a change would build a request the API is about to reject.
  // `useWatch`, not `watch()`: it subscribes to this one field instead of re-rendering the whole
  // form on every keystroke anywhere in it, and it is the API `react-hooks/incompatible-library`
  // accepts — `watch()` cannot be memoized safely. `register-form.tsx` records the same choice.
  const chosenCountry = useWatch({ control, name: 'countryCode' });
  const legalForms = countries.find((country) => country.value === chosenCountry)?.legalForms ?? [];

  const submit = handleSubmit((fields) => {
    setFailure(null);
    setSaved(false);
    const patch: UpdateOrganizationRequest = {
      name: fields.name.trim(),
      countryCode: fields.countryCode,
      legalForm: orNull(fields.legalForm),
      idno: orNull(fields.idno),
      lei: orNull(fields.lei)?.toUpperCase() ?? null,
      registeredAddressLine1: orNull(fields.registeredAddressLine1),
      registeredAddressLine2: orNull(fields.registeredAddressLine2),
      registeredLocality: orNull(fields.registeredLocality),
      registeredPostalCode: orNull(fields.registeredPostalCode),
      contactEmail: orNull(fields.contactEmail),
      contactPhone: orNull(fields.contactPhone),
      reportContactName: orNull(fields.reportContactName),
      reportContactEmail: orNull(fields.reportContactEmail),
    };

    startTransition(async () => {
      const result = await updateOrganizationProfileAction(patch);
      if (result.status === API_OUTCOME.Ok) {
        // Re-seed from what was STORED, not from what was typed — see the docblock.
        setCurrent(result.value);
        reset(toFields(result.value));
        setSaved(true);
        return;
      }
      setFailure(result);
    });
  });

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <RecordShell
        title={t('title')}
        summary={t('lede')}
        attribution={<ProfileAttribution lastChange={current.lastChange} />}
        actions={
          <div className={styles.actions}>
            {/* Inert until a field differs, which the line beside it says in words rather than
                leaving the reader to infer it from a greyed control (UX-102). */}
            <Button type="submit" busy={pending} disabled={!formState.isDirty}>
              {t('save')}
            </Button>
            <Button
              type="button"
              variant={BUTTON_VARIANT.SUBTLE}
              disabled={!formState.isDirty || pending}
              onClick={() => {
                setFailure(null);
                setSaved(false);
                reset(toFields(current));
              }}
            >
              {t('discard')}
            </Button>
            <p className={`t-caption ${styles.dirtyHint}`}>
              {formState.isDirty ? t('unsaved') : t('pristine')}
            </p>
          </div>
        }
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />

        {saved ? (
          <Callout intent={CALLOUT_INTENT.SUCCESS} title={t('saved.title')} action={null}>
            {t('saved.body')}
          </Callout>
        ) : null}

        {failure?.status === API_OUTCOME.Problem ? (
          <Callout
            intent={CALLOUT_INTENT.ERROR}
            title={failure.problem.title ?? t('problemTitle')}
            action={null}
          >
            {failure.problem.detail ?? t('problemBody')}
          </Callout>
        ) : null}

        {failure?.status === API_OUTCOME.Unreachable ? (
          <Callout
            intent={CALLOUT_INTENT.ERROR}
            title={tCommon('unreachable.title')}
            action={tCommon('unreachable.action')}
          >
            {tCommon('unreachable.body')}
          </Callout>
        ) : null}

        <RecordSection id="identity" heading={t('identity.heading')} description={t('identity.lede')}>
          <FormTextField
            control={control}
            name="name"
            label={t('identity.name')}
            help={t('identity.nameHelp')}
            autoComplete="organization"
            rules={{
              required: t('identity.nameRequired'),
              maxLength: { value: 200, message: t('identity.nameTooLong') },
            }}
          />
          <FormSelect
            control={control}
            name="countryCode"
            label={t('identity.country')}
            help={t('identity.countryHelp')}
            placeholder={t('identity.countryPlaceholder')}
            options={countries.map((country) => ({
              value: country.value,
              label: country.label,
            }))}
            rules={{ required: t('identity.countryRequired') }}
          />
          <FormSelect
            control={control}
            name="legalForm"
            label={t('identity.legalForm')}
            help={t('identity.legalFormHelp')}
            placeholder={t('identity.legalFormPlaceholder')}
            options={legalForms.map((form) => ({ value: form.value, label: form.label }))}
          />
        </RecordSection>

        <RecordSection
          id="identifiers"
          heading={t('identifiers.heading')}
          description={t('identifiers.lede')}
        >
          <FormTextField
            control={control}
            name="idno"
            label={t('identifiers.idno')}
            help={t('identifiers.idnoHelp')}
            inputMode="numeric"
            rules={{
              // Shape only, because the thirteenth digit's algorithm is not published in the
              // defining instrument — `validateIdno` says so, and a check this screen invented
              // would refuse real registrations at the door.
              validate: (value: string) =>
                !value.trim() || validateIdno(value.trim()).shape || t('identifiers.idnoMalformed'),
            }}
          />
          <FormTextField
            control={control}
            name="lei"
            label={t('identifiers.lei')}
            help={t('identifiers.leiHelp')}
            rules={{
              // Two verdicts, two sentences: a wrong shape is retyped, disagreeing check digits
              // mean the reader copied the wrong identifier. One boolean would say neither.
              validate: (value: string) => {
                const trimmed = value.trim().toUpperCase();
                if (!trimmed) return true;
                const verdict = validateLei(trimmed);
                if (!verdict.shape) return t('identifiers.leiMalformed');
                return verdict.checkDigits === true || t('identifiers.leiCheckDigits');
              },
            }}
          />
        </RecordSection>

        <RecordSection
          id="registered-address"
          heading={t('address.heading')}
          description={t('address.lede')}
        >
          <FormTextField
            control={control}
            name="registeredAddressLine1"
            label={t('address.line1')}
            autoComplete="address-line1"
            rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
          />
          <FormTextField
            control={control}
            name="registeredAddressLine2"
            label={t('address.line2')}
            autoComplete="address-line2"
            rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
          />
          <FormTextField
            control={control}
            name="registeredLocality"
            label={t('address.locality')}
            autoComplete="address-level2"
            rules={{ maxLength: { value: 120, message: t('address.localityTooLong') } }}
          />
          <FormTextField
            control={control}
            name="registeredPostalCode"
            label={t('address.postalCode')}
            autoComplete="postal-code"
            rules={{ maxLength: { value: 20, message: t('address.postalCodeTooLong') } }}
          />
        </RecordSection>

        <RecordSection
          id="contacts"
          heading={t('contacts.heading')}
          description={t('contacts.lede')}
        >
          <FormTextField
            control={control}
            name="contactEmail"
            type="email"
            label={t('contacts.platformEmail')}
            help={t('contacts.platformEmailHelp')}
            autoComplete="email"
            inputMode="email"
            rules={{ pattern: { value: EMAIL_SHAPE, message: t('contacts.emailInvalid') } }}
          />
          <FormTextField
            control={control}
            name="contactPhone"
            type="tel"
            label={t('contacts.platformPhone')}
            autoComplete="tel"
            inputMode="tel"
            rules={{ maxLength: { value: 40, message: t('contacts.phoneTooLong') } }}
          />
          <FormTextField
            control={control}
            name="reportContactName"
            label={t('contacts.reportName')}
            help={t('contacts.reportNameHelp')}
            rules={{ maxLength: { value: 200, message: t('contacts.reportNameTooLong') } }}
          />
          <FormTextField
            control={control}
            name="reportContactEmail"
            type="email"
            label={t('contacts.reportEmail')}
            help={t('contacts.reportEmailHelp')}
            inputMode="email"
            rules={{ pattern: { value: EMAIL_SHAPE, message: t('contacts.emailInvalid') } }}
          />
        </RecordSection>
      </RecordShell>
    </form>
  );
}
