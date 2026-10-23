import { DisclosureField, FIELD_TONE } from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import styles from './answering.module.css';

/**
 * Three questions as the wizard draws them — one still to answer, one declared not available with its reason, one
 * answered with zero — the three answers §6.2's anatomy exists for, so a visitor sees that a missing number has an
 * honest answer before they meet one.
 *
 * **Drawn by `DisclosureField` in its read-only form, in the wizard's words**: the markers, the *prior period* line and
 * the *reason recorded* line come from the wizard's own catalogue, so the picture says what the product will. `inert`
 * with a caption, for the hero's figure's reason — it is a picture, and takes no answers.
 */
export async function AnsweringFigure() {
  const [t, tField, format] = await Promise.all([
    getTranslations(`${MARKETING_MESSAGES}.answering.figure`),
    getTranslations('organization.wizard.field'),
    getFormatter(),
  ]);

  return (
    <figure className={styles.figure}>
      <div className={styles.fields} inert>
        <DisclosureField
          label={t('leavers.label')}
          help={t('leavers.help')}
          marker={tField('markers.missing')}
          markerTone={FIELD_TONE.ATTENTION}
          priorPeriod={tField('prior', { value: t('leavers.prior', { count: 14 }) })}
          notAvailable={null}
          readOnly
        >
          <p className={styles.empty}>{tField('unanswered')}</p>
        </DisclosureField>
        <DisclosureField
          label={t('water.label')}
          help={t('water.help')}
          marker={tField('markers.not_available')}
          markerTone={FIELD_TONE.REASONED}
          message={
            <>
              <span className={styles.recorded}>{tField('notAvailable.recorded')}</span>
              {t('water.reason')}
            </>
          }
          messageTone={FIELD_TONE.REASONED}
          notAvailable={null}
          readOnly
        >
          <p className={styles.empty}>{tField('unanswered')}</p>
        </DisclosureField>
        <DisclosureField
          label={t('accidents.label')}
          help={t('accidents.help')}
          marker={tField('markers.nil_return')}
          markerTone={FIELD_TONE.OK}
          message={t('accidents.zero')}
          messageTone={FIELD_TONE.OK}
          notAvailable={null}
          readOnly
        >
          <p className={styles.value}>{format.number(0)}</p>
        </DisclosureField>
      </div>
      <figcaption className={`t-caption ${styles.caption}`}>{t('caption')}</figcaption>
    </figure>
  );
}
