'use client';

import {
  Button,
  BUTTON_VARIANT,
  Callout,
  CALLOUT_INTENT,
  ConsequenceDialogue,
  RecordSection,
  RecordShell,
} from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import type {
  CreateReportingEntityRequest,
  NaceCodeMatch,
  ReportingEntity,
} from '@easyesg/contracts';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { useRouter } from '@/i18n/navigation';
import { ROUTES, entityRoute } from '@/lib/routes';
import { archiveEntityAction, createEntityAction, updateEntityAction } from '../actions';
import { CONSOLIDATION_BASIS, ENTITY_STANDING } from '../entities';
import { ActivityPicker } from './activity-picker';
import styles from './entities.module.css';

/**
 * S-13's Record — UC-52, UC-53, UC-54 and UC-55 on one screen (FR-17 … FR-20).
 *
 * **One form, one save, and the artboard's own caption says why**: *"The wizard autosaves; this
 * does not. A change here rewrites what other people see inside an open report, so it waits for an
 * explicit act and says what the act will cause."* That is §5's *explicit save with field-level
 * validation, unlike the wizard*, and it is the reason `RecordShell`'s `actions` slot carries the
 * pair while the sections are grouping.
 *
 * **Sites and consolidation members are whole-collection saves**, because that is the API's own
 * semantics: a member with an id is edited, one without is added, and a stored member the array
 * omits is removed. So the form holds both lists and sends what it holds — a per-row write would
 * have to invent an ordering between "add" and "remove" that the endpoint does not have.
 *
 * **The consolidation basis is null until stated**, which VSME asks explicitly, so there is no
 * default answering it on the undertaking's behalf (FR-19). Setting `consolidated` with no
 * subsidiary is refused by the API and the screen does not pre-empt that: the refusal names the
 * boundary, and a client-side guard would be a second copy of a rule that can change.
 *
 * States (§5's list): loading — initial and refresh are the page's · error — recoverable is the
 * API's problem document as received · success re-seeds and says so · **read-only** is the archived
 * entity, which UX-13 requires to name its cause and what restores editing — here nothing does,
 * and the screen says that rather than implying a reversal exists.
 */
export interface EntityRecordFormProps {
  /** Null in create mode. §4.6's Record has no identity header until the object exists. */
  readonly entity: ReportingEntity | null;
  /** The words for the codes it already holds. Empty in create mode. */
  readonly activity: readonly NaceCodeMatch[];
  /** Legal forms for the organization's country, already labelled by the page. */
  readonly legalForms: readonly { readonly value: string; readonly label: string }[];
}

interface SiteFields {
  id?: string;
  name: string;
  addressLine1: string;
  locality: string;
  postalCode: string;
}

interface MemberFields {
  id?: string;
  name: string;
  idno: string;
  countryCode: string;
}

interface EntityFields {
  name: string;
  legalForm: string;
  consolidationBasis: string;
  sites: SiteFields[];
  consolidationMembers: MemberFields[];
}

const orNull = (value: string): string | null => (value.trim() ? value.trim() : null);

const toFields = (entity: ReportingEntity | null): EntityFields => ({
  name: entity?.name ?? '',
  legalForm: entity?.legalForm ?? '',
  consolidationBasis: entity?.consolidationBasis ?? '',
  sites: (entity?.sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    addressLine1: site.addressLine1 ?? '',
    locality: site.locality ?? '',
    postalCode: site.postalCode ?? '',
  })),
  consolidationMembers: (entity?.consolidationMembers ?? []).map((member) => ({
    id: member.id,
    name: member.name,
    idno: member.idno ?? '',
    countryCode: member.countryCode ?? '',
  })),
});

export function EntityRecordForm({ entity, activity, legalForms }: EntityRecordFormProps) {
  const t = useTranslations('organization.entities.record');
  const tForms = useTranslations('forms');
  const tCommon = useTranslations('identity');
  const router = useRouter();

  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [saved, setSaved] = useState(false);
  const [codes, setCodes] = useState<readonly NaceCodeMatch[]>(activity);
  const [confirmingArchive, setConfirmingArchive] = useState(false);

  const archived = entity?.status === ENTITY_STANDING.ARCHIVED;

  const { control, handleSubmit, reset, formState } = useForm<EntityFields>({
    mode: 'onTouched',
    defaultValues: toFields(entity),
  });

  const sites = useFieldArray({ control, name: 'sites' });
  const members = useFieldArray({ control, name: 'consolidationMembers' });

  // The activity list lives outside the form, so `isDirty` cannot see it — tracked beside it and
  // OR'd in. A `useFieldArray` of codes would put the words in form state where nothing edits them.
  const codesChanged =
    codes.length !== activity.length ||
    codes.some((code, index) => code.code !== activity[index]?.code);
  const dirty = formState.isDirty || codesChanged;

  const submit = handleSubmit((fields) => {
    setFailure(null);
    setSaved(false);

    const body: CreateReportingEntityRequest = {
      name: fields.name.trim(),
      legalForm: orNull(fields.legalForm),
      naceCodes: codes.map((code) => code.code),
      consolidationBasis: fields.consolidationBasis === '' ? null : (fields.consolidationBasis as 'individual' | 'consolidated'),
      sites: fields.sites.map((site) => ({
        ...(site.id ? { id: site.id } : {}),
        name: site.name.trim(),
        addressLine1: orNull(site.addressLine1),
        locality: orNull(site.locality),
        postalCode: orNull(site.postalCode),
      })),
      consolidationMembers: fields.consolidationMembers.map((member) => ({
        ...(member.id ? { id: member.id } : {}),
        name: member.name.trim(),
        idno: orNull(member.idno),
        countryCode: orNull(member.countryCode),
      })),
    };

    startTransition(async () => {
      const result = entity
        ? await updateEntityAction({ entityId: entity.id, patch: body })
        : await createEntityAction(body);

      if (result.status === API_OUTCOME.Ok) {
        if (!entity) {
          // Created: the record now has an address of its own, and staying on `/entities/new`
          // would leave a reader one refresh away from creating a second one.
          router.push(entityRoute(result.value.id));
          return;
        }
        reset(toFields(result.value));
        setSaved(true);
        return;
      }
      setFailure(result);
    });
  });

  const archive = (): void => {
    if (!entity) return;
    startTransition(async () => {
      const result = await archiveEntityAction({ entityId: entity.id });
      setConfirmingArchive(false);
      if (result.status === API_OUTCOME.Ok) {
        router.push(ROUTES.ENTITIES);
        return;
      }
      setFailure(result);
    });
  };

  return (
    <form onSubmit={(event) => void submit(event)} noValidate>
      <RecordShell
        title={entity ? entity.name : t('createTitle')}
        summary={entity ? t('lede') : t('createLede')}
        actions={
          archived ? null : (
            <div className={styles.actions}>
              <Button type="submit" busy={pending} disabled={!dirty}>
                {entity ? t('save') : t('create')}
              </Button>
              <Button
                type="button"
                variant={BUTTON_VARIANT.SUBTLE}
                disabled={!dirty || pending}
                onClick={() => {
                  setFailure(null);
                  setSaved(false);
                  setCodes(activity);
                  reset(toFields(entity));
                }}
              >
                {t('discard')}
              </Button>
              {entity ? (
                <Button
                  type="button"
                  variant={BUTTON_VARIANT.DESTRUCTIVE}
                  onClick={() => setConfirmingArchive(true)}
                >
                  {t('archive.action')}
                </Button>
              ) : null}
            </div>
          )
        }
      >
        <FormSummary control={control} title={tForms('summaryTitle')} />

        {/* UX-13: a read-only state names which of the three causes applies. Here it is FR-20's
            archive, and nothing restores editing — saying so is more honest than implying a
            reversal the product does not offer. */}
        {archived ? (
          <Callout intent={CALLOUT_INTENT.INFO} title={t('archived.title')} action={null}>
            {t('archived.body')}
          </Callout>
        ) : null}

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
            disabled={archived}
            rules={{
              required: t('identity.nameRequired'),
              maxLength: { value: 200, message: t('identity.nameTooLong') },
            }}
          />
          <FormSelect
            control={control}
            name="legalForm"
            label={t('identity.legalForm')}
            placeholder={t('identity.legalFormPlaceholder')}
            disabled={archived}
            options={legalForms}
          />
          {archived ? null : (
            <ActivityPicker
              chosen={codes}
              onChange={setCodes}
              labels={{
                label: t('identity.activity'),
                help: t('identity.activityHelp'),
                placeholder: t('identity.activityPlaceholder'),
                prompt: t('identity.activityPrompt'),
                empty: t('identity.activityEmpty'),
                searching: t('identity.activitySearching'),
                remove: (name) => t('identity.activityRemove', { activity: name }),
                removeShort: t('identity.activityRemoveShort'),
                none: t('identity.activityNone'),
              }}
            />
          )}
        </RecordSection>

        <RecordSection id="boundary" heading={t('boundary.heading')} description={t('boundary.lede')}>
          <FormSelect
            control={control}
            name="consolidationBasis"
            label={t('boundary.basis')}
            help={t('boundary.basisHelp')}
            placeholder={t('boundary.basisPlaceholder')}
            disabled={archived}
            options={Object.values(CONSOLIDATION_BASIS).map((basis) => ({
              value: basis,
              label: t(`boundary.options.${basis}`),
            }))}
          />

          {members.fields.map((field, index) => (
            <fieldset key={field.id} className={styles.rowGroup}>
              <legend className="t-label">{t('boundary.member', { position: index + 1 })}</legend>
              <FormTextField
                control={control}
                name={`consolidationMembers.${index}.name`}
                label={t('boundary.memberName')}
                disabled={archived}
                rules={{ required: t('boundary.memberNameRequired') }}
              />
              <FormTextField
                control={control}
                name={`consolidationMembers.${index}.idno`}
                label={t('boundary.memberIdno')}
                disabled={archived}
              />
              {archived ? null : (
                <Button
                  type="button"
                  variant={BUTTON_VARIANT.SUBTLE}
                  onClick={() => members.remove(index)}
                >
                  {t('boundary.removeMember')}
                </Button>
              )}
            </fieldset>
          ))}

          {archived ? null : (
            <Button
              type="button"
              variant={BUTTON_VARIANT.SUBTLE}
              onClick={() => members.append({ name: '', idno: '', countryCode: '' })}
            >
              {t('boundary.addMember')}
            </Button>
          )}
        </RecordSection>

        <RecordSection id="sites" heading={t('sites.heading')} description={t('sites.lede')}>
          {sites.fields.map((field, index) => (
            <fieldset key={field.id} className={styles.rowGroup}>
              <legend className="t-label">{t('sites.site', { position: index + 1 })}</legend>
              <FormTextField
                control={control}
                name={`sites.${index}.name`}
                label={t('sites.name')}
                disabled={archived}
                rules={{ required: t('sites.nameRequired') }}
              />
              <FormTextField
                control={control}
                name={`sites.${index}.addressLine1`}
                label={t('sites.address')}
                disabled={archived}
              />
              <FormTextField
                control={control}
                name={`sites.${index}.locality`}
                label={t('sites.locality')}
                disabled={archived}
              />
              {archived ? null : (
                <Button
                  type="button"
                  variant={BUTTON_VARIANT.SUBTLE}
                  onClick={() => sites.remove(index)}
                >
                  {t('sites.remove')}
                </Button>
              )}
            </fieldset>
          ))}

          {archived ? null : (
            <Button
              type="button"
              variant={BUTTON_VARIANT.SUBTLE}
              onClick={() =>
                sites.append({ name: '', addressLine1: '', locality: '', postalCode: '' })
              }
            >
              {t('sites.add')}
            </Button>
          )}
        </RecordSection>
      </RecordShell>

      {/* §6.14 and UX-70: the consequence names the object and what stops, and UX-69's reassurance
          names what survives. FR-20 makes that reassurance the whole point — filed reports stay
          downloadable exactly as distributed. */}
      {entity ? (
        <ConsequenceDialogue
          open={confirmingArchive}
          object={entity.name}
          title={t('archive.title')}
          consequence={t('archive.consequence')}
          retained={t('archive.retained')}
          confirmLabel={t('archive.confirm')}
          cancelLabel={t('archive.cancel')}
          busy={pending}
          onConfirm={archive}
          onCancel={() => setConfirmingArchive(false)}
        />
      ) : null}
    </form>
  );
}
