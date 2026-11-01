'use client';

import { RecordSection } from '@easyesg/ui';
import { FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { EntityFields } from '../../../tools/entity-fields';
import { ENTITY_RECORD_MESSAGES } from '../../shared/entity-messages';
import styles from '../../styles/entities.module.css';

/**
 * The company's registered address, as the state register holds it (FR-17 as amended) — S-15's until task 177 moved it
 * here with the rest of what a report prints; the organization is the account, and a group's companies each have
 * their own address.
 *
 * **Four free-text fields and no structure beyond the `autoComplete` tokens.** The platform operates across
 * jurisdictions whose address shapes differ, and a form that imposed one would refuse a correct entry somewhere; the
 * tokens let a browser fill it without this screen deciding what a locality is. **In two pairs**, the lines together
 * and the town beside its postal code, as the identity section pairs its fields where the card has room.
 *
 * **Every rule here is a length, which is the line `apps/web/CLAUDE.md` draws**: the column widths, which the API
 * refuses past regardless — the message arrives before the round trip, not instead of it. `address.lineTooLong` is
 * shared by both lines deliberately, and the summary links each occurrence to its own control (UX-111).
 */
export function AddressSection({
  control,
  archived,
}: {
  readonly control: Control<EntityFields>;
  readonly archived: boolean;
}) {
  const t = useTranslations(ENTITY_RECORD_MESSAGES);

  return (
    <RecordSection id="registered-address" heading={t('address.heading')} description={t('address.lede')}>
      <div className={styles.fieldPair}>
        <FormTextField
          control={control}
          name="registeredAddressLine1"
          label={t('address.line1')}
          autoComplete="address-line1"
          disabled={archived}
          rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
        />
        <FormTextField
          control={control}
          name="registeredAddressLine2"
          label={t('address.line2')}
          autoComplete="address-line2"
          disabled={archived}
          rules={{ maxLength: { value: 200, message: t('address.lineTooLong') } }}
        />
      </div>
      <div className={styles.fieldPair}>
        <FormTextField
          control={control}
          name="registeredLocality"
          label={t('address.locality')}
          autoComplete="address-level2"
          disabled={archived}
          rules={{ maxLength: { value: 120, message: t('address.localityTooLong') } }}
        />
        <FormTextField
          control={control}
          name="registeredPostalCode"
          label={t('address.postalCode')}
          autoComplete="postal-code"
          disabled={archived}
          rules={{ maxLength: { value: 20, message: t('address.postalCodeTooLong') } }}
        />
      </div>
    </RecordSection>
  );
}
