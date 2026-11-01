import { BUTTON_VARIANT, Button } from '@easyesg/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { decimalForReading } from '@/lib/decimal-input';
import type { NumberReadings } from '@/lib/number-entry';
import styles from './number-choice.module.css';

/**
 * The two readings of a number typed so it reads two ways, each a button (task 220; `architecture.md` §12.5.6's task-220
 * row (a)): `1.240` in Romanian offers *1.240* and *1,24*, each laid out as the reader reads it, so the choice is made
 * in the reader's own format. **The question is the field's error**, NFR-79's three parts beneath the field it is about,
 * so a form's summary lists it like any refusal and this draws only the answers.
 *
 * **In `shared/` on its admission test**: `NumberField` draws it, and so do S-09's add-a-source and override forms,
 * whose figures are react-hook-form fields rather than this app's number field. No directive: it holds no state, and its
 * readers are Client Components already.
 */
export function NumberChoice({
  readings,
  onChoose,
}: {
  readonly readings: NumberReadings;
  /** Called with the canonical value of the reading chosen. */
  readonly onChoose: (value: string) => void;
}) {
  const t = useTranslations('forms.number');
  const format = useFormatter();
  return (
    <div className={styles.choice} role="group" aria-label={t('choose')}>
      {[readings.thousands, readings.decimal].map((value) => (
        <Button key={value} type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => onChoose(value)}>
          {decimalForReading({ value, format })}
        </Button>
      ))}
    </div>
  );
}
