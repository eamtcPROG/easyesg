'use client';

import { RecordSection } from '@easyesg/ui';
import { FormSelect, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { NaceCodeMatch } from '@easyesg/contracts';
import type { EntityFields } from '../../tools/entity-fields';
import { ActivityPicker } from './activity-picker';
import { ENTITY_RECORD_MESSAGES } from '../shared/entity-messages';

/**
 * The name, the legal form and the activity (FR-17). The activity list lives outside the form —
 * see `tools/entity-record-state.ts` — so this section reports a change rather than registering a
 * field for it.
 */
export function IdentitySection({
  control,
  legalForms,
  archived,
  codes,
  onCodesChangeAction,
}: {
  readonly control: Control<EntityFields>;
  readonly legalForms: readonly { readonly value: string; readonly label: string }[];
  readonly archived: boolean;
  readonly codes: readonly NaceCodeMatch[];
  readonly onCodesChangeAction: (codes: readonly NaceCodeMatch[]) => void;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
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
          onChange={onCodesChangeAction}
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
  );
}
