import {
  DisclosureField,
  FIELD_TONE,
  UnitLabel,
  WizardModuleGroup,
  WizardModuleItem,
  WIZARD_STEP_STATE,
  type WizardStepState,
} from '@easyesg/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { MARKETING_ANCHOR } from '../shared/marketing-anchors';
import { MARKETING_MESSAGES } from '../shared/marketing-messages';
import { HERO_SAMPLE_STEPS, sampleRollUp, type SampleStep } from '../../tools/hero-sample';
import styles from './hero-figure.module.css';

/**
 * The hero's picture — S-29's *"real interface fragments stand in for imagery"*: the wizard's step list and one of its
 * questions, drawn by the inventory's own `WizardModuleGroup`, `WizardModuleItem` and `DisclosureField` over a sample
 * report, so what a visitor sees here is what they will see after signing up and nothing depends on an image existing.
 *
 * **It speaks the wizard's words**, read from the wizard's own catalogue — the rail's states, the field's marker and its
 * *prior period* line — so the picture cannot drift from the product it shows. Only the sample's own content, the
 * question and its finding, is the home's.
 *
 * **`inert`, with a caption**: it is a picture, so nothing in it takes focus or reaches the accessibility tree, and the
 * `figcaption` says in words what it shows. A visitor tabbing the page meets the hero's two actions, then the next band.
 * The field is the read-only form a locked report shows (UX-13), since a picture takes no answers.
 */
export async function HeroFigure() {
  const [t, tModules, tRail, tField, format] = await Promise.all([
    getTranslations(`${MARKETING_MESSAGES}.hero.figure`),
    getTranslations('reportModules'),
    getTranslations('organization.wizard.rail.state'),
    getTranslations('organization.wizard.field'),
    getFormatter(),
  ]);

  const statusOf = (step: SampleStep): string =>
    step.state === WIZARD_STEP_STATE.IN_PROGRESS
      ? tRail('inProgress', { count: step.outstanding ?? 0 })
      : tRail(RAIL_WORD[step.state]);

  return (
    <figure className={styles.figure}>
      <div className={styles.frame} inert>
        <div className={styles.rail}>
          <WizardModuleGroup
            name={t('module')}
            count={t('count', sampleRollUp(HERO_SAMPLE_STEPS))}
            segments={HERO_SAMPLE_STEPS.map((step) => ({ key: step.code, state: step.state }))}
          >
            {HERO_SAMPLE_STEPS.map((step) => (
              <WizardModuleItem
                key={step.code}
                href={`#${MARKETING_ANCHOR.QUESTIONS}`}
                label={t('step', { code: step.code, name: tModules(step.code) })}
                state={step.state}
                status={statusOf(step)}
                current={step.current}
              />
            ))}
          </WizardModuleGroup>
        </div>
        <div className={styles.question}>
          <DisclosureField
            label={t('field.label')}
            help={t('field.help')}
            marker={tField('markers.inconsistency')}
            markerTone={FIELD_TONE.WARNING}
            unit={<UnitLabel>{t('field.unit')}</UnitLabel>}
            priorPeriod={tField('prior', { value: t('field.prior', { value: 1187 }) })}
            message={t('field.message')}
            messageTone={FIELD_TONE.WARNING}
            notAvailable={null}
            readOnly
          >
            <p className={styles.value}>{format.number(1240)}</p>
          </DisclosureField>
        </div>
      </div>
      <figcaption className={`t-caption ${styles.caption}`}>{t('caption')}</figcaption>
    </figure>
  );
}

/** The rail's word for each state that carries no count — the wizard catalogue's own keys. */
const RAIL_WORD = {
  [WIZARD_STEP_STATE.COMPLETE]: 'complete',
  [WIZARD_STEP_STATE.NOT_STARTED]: 'notStarted',
  [WIZARD_STEP_STATE.OMITTED]: 'omitted',
  [WIZARD_STEP_STATE.WAITING]: 'waiting',
  [WIZARD_STEP_STATE.INAPPLICABLE]: 'inapplicable',
  [WIZARD_STEP_STATE.UNCHECKED]: 'unchecked',
} as const satisfies Readonly<Record<Exclude<WizardStepState, typeof WIZARD_STEP_STATE.IN_PROGRESS>, string>>;
