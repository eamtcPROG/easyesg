import { getTranslations } from 'next-intl/server';
import { WIZARD_MESSAGES } from '@/features/wizard/components/shared/wizard-messages';
import { moduleLabel } from '@/features/wizard/tools/module-words';
import type { StripModule } from '../../../tools/module-strip';
import { OVERVIEW_MESSAGES } from '../shared/overview-messages';
import styles from '../../styles/home.module.css';

/**
 * The resume card's strip — one cell per module the report asks, in the standard's order, each in its state's tone
 * and the one where work stopped ringed (task 255).
 *
 * **An ordered list, and every cell names itself in full.** The printed `B3` and the colour are for the eye; a screen
 * reader hears *B3 — Energy and emissions: needs a fix*, so neither the reference nor the tone is the sole carrier
 * (UX-102), and the cell where work stopped is the list's current step. At compact the printed references go, as the
 * 390 artboard draws the strip bare, and the names stay.
 *
 * **Not links.** Eleven tab stops between the reader and *Continue* would bury the card's one action; the module list
 * one press away on S-07 is where a module is chosen, which is *See all modules*.
 */
export async function ResumeStrip({ strip }: { readonly strip: readonly StripModule[] }) {
  const [t, tState, tWizard] = await Promise.all([
    getTranslations(`${OVERVIEW_MESSAGES}.resume`),
    // Its own narrow translator, so the state key below is a union of seven leaves rather than every leaf of `resume`.
    getTranslations(`${OVERVIEW_MESSAGES}.resume.state`),
    getTranslations(WIZARD_MESSAGES),
  ]);

  return (
    <ol className={styles.strip} aria-label={t('stripLabel')}>
      {strip.map((entry) => (
        <li
          key={entry.module}
          className={styles.stripModule}
          data-state={entry.state}
          data-current={entry.current || undefined}
          aria-current={entry.current ? 'step' : undefined}
        >
          <span className={styles.stripReference} aria-hidden="true">
            {entry.module}
          </span>
          <span className={styles.visuallyHidden}>
            {t('stripItem', { module: moduleLabel(tWizard, entry.module), state: tState(entry.state) })}
          </span>
        </li>
      ))}
    </ol>
  );
}
