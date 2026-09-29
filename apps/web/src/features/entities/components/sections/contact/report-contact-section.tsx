'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import { EMAIL_SHAPE } from '@/lib/email-shape';
import type { EntityFields } from '../../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import styles from '../../styles/entities.module.css';

/**
 * The person a reader of this company's report writes to about its content, printed on the report's cover — FR-15's
 * report-cover contact, the entity's since task 177, so a group's companies may each name their own. **Not the
 * platform's contact**, which is the organization's on S-15 and never printed; the section says whose it is so the two
 * cannot be taken for one another.
 */
export function ReportContactSection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <RecordSection id="report-contact" heading={t('reportContact.heading')} description={t('reportContact.lede')}>
      <div className={styles.fieldPair}>
        <FormTextField
          control={control}
          name="reportContactName"
          label={t('reportContact.name')}
          help={t('reportContact.nameHelp')}
          autoComplete="name"
          disabled={archived}
          rules={{ maxLength: { value: 200, message: t('reportContact.nameTooLong') } }}
        />
        <FormTextField
          control={control}
          name="reportContactEmail"
          type="email"
          label={t('reportContact.email')}
          help={t('reportContact.emailHelp')}
          autoComplete="email"
          inputMode="email"
          disabled={archived}
          rules={{ pattern: { value: EMAIL_SHAPE, message: t('reportContact.emailInvalid') } }}
        />
      </div>
    </RecordSection>
  );
}
