import { NOTIFICATION_CLASSIFICATION, type ConsoleCategory } from '@easyesg/contracts';
import { BUTTON_VARIANT, Button, Fieldset } from '@easyesg/ui';
import { FormCheckbox, FormSelect, FormSummary } from '@easyesg/ui/forms';
import { useId, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'use-intl';
import {
  behaviourFieldsOf,
  behaviourRequestOf,
  editableControlsOf,
  type CategoryBehaviourFields,
} from '../../../tools/category-behaviour';
import { CATEGORY_CONTROL, type CategoryAction } from '../../../tools/category-action-state';

/**
 * A-17's behaviour editor (task 67.10; UC-176, FR-173) — a checkbox per channel and the classification, with an
 * explicit *preview and publish* rather than a save: UX-123's preview comes first, so what the operator presses asks
 * what the change does before it does it.
 *
 * **A control code fixes is shown fixed, with its reason** (§5.2 A-17 as amended 21 Sep 2026) — read from the api's
 * `mandatory` and `addressNotice`, never re-derived here. **Only the field-level check lives here**: at least one
 * channel. Whether a channel has its words in every language is the api's judgement, and arrives as a refusal worded
 * by the api. **Publish is offered once something changed**, since the api refuses a behaviour identical to what is in
 * force.
 */
export function CategoryBehaviourForm({
  category,
  busy,
  onPreview,
}: {
  readonly category: ConsoleCategory;
  readonly busy: boolean;
  readonly onPreview: (action: CategoryAction) => void;
}) {
  const t = useTranslations('platform.notificationCategories.form');
  const tClassification = useTranslations('platform.notificationCategories.classification');
  const titleId = useId();
  const editable = editableControlsOf(category);
  const { control, handleSubmit, reset, formState, getValues } = useForm<CategoryBehaviourFields>({
    mode: 'onSubmit',
    defaultValues: behaviourFieldsOf(category),
  });

  const options = useMemo(
    () =>
      Object.values(NOTIFICATION_CLASSIFICATION).map((value) => ({
        value,
        label: tClassification(value),
        description: t(`classificationMeans.${value}`),
      })),
    [t, tClassification],
  );

  const submit = handleSubmit((fields) => {
    onPreview({
      control: CATEGORY_CONTROL.PUBLISH,
      categoryKey: category.categoryKey,
      behaviour: behaviourRequestOf(fields),
      expectedRevision: category.inForce?.revision ?? 0,
    });
  });

  // One rule on the pair, carried by the first channel: a message on each box would say the same thing twice.
  const oneChannel = () => getValues('inApp') || getValues('email') || t('channelsMissing');

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-[var(--space-3)]">
      <h3 id={titleId} className="t-body-strong">
        {t('title')}
      </h3>
      <p className="t-caption text-[var(--text-muted)]">{t('lede')}</p>

      <form method="post" onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-[var(--space-4)]">
        <FormSummary control={control} title={t('summaryTitle')} />

        <Fieldset legend={t('channelsLegend')}>
          <FormCheckbox
            control={control}
            name="inApp"
            label={t('inAppLabel')}
            help={editable.inApp ? undefined : t('inAppFixed')}
            disabled={!editable.inApp}
            rules={{ validate: oneChannel }}
          />
          <FormCheckbox
            control={control}
            name="email"
            label={t('emailLabel')}
            help={editable.email ? undefined : t('emailFixed')}
            disabled={!editable.email}
          />
        </Fieldset>

        {editable.classification ? (
          <FormSelect control={control} name="classification" label={t('classificationLabel')} options={options} />
        ) : (
          <p className="t-body">{t('classificationFixed')}</p>
        )}

        <div className="flex flex-wrap gap-[var(--space-3)]">
          <Button type="submit" busy={busy} disabled={busy || !formState.isDirty}>
            {t('preview')}
          </Button>
          <Button
            type="button"
            variant={BUTTON_VARIANT.SECONDARY}
            disabled={!formState.isDirty}
            onClick={() => reset(behaviourFieldsOf(category))}
          >
            {t('reset')}
          </Button>
        </div>
      </form>
    </section>
  );
}
