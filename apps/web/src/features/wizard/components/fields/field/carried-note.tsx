import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { FIELD_MESSAGES } from '../shared/step-messages';
import styles from '../styles/step.module.css';

/**
 * **A carried value's note, and the one act that clears its mark unedited** (task 191; FR-47 item 4, UX-32 as amended
 * 5 Oct 2026) — in the field's message line, as `EasyESG Reporting Core.dc.html` draws the field's carried variant:
 * what the mark means, then *confirm unchanged*, which writes the stored value again with the mark off
 * (`confirmedWrite`).
 *
 * Drawn only where the act is offered — an editable step, a value the reporter answers rather than one a calculator
 * run wrote, and nothing of this field still unsent — so the sentence never names an act the reader cannot take, and a
 * view-only member sees the marker alone. No directive: drawn inside `StepField`, a client boundary already, and it
 * reads its own words (task 158).
 */
export function CarriedNote({ onConfirm }: { readonly onConfirm: () => void }) {
  const t = useTranslations(FIELD_MESSAGES);
  return (
    <span className={styles.carried}>
      <span>{t('carriedNote.body')}</span>
      <Button variant={BUTTON_VARIANT.SUBTLE} onClick={onConfirm}>
        {t('carriedNote.confirm')}
      </Button>
    </span>
  );
}
