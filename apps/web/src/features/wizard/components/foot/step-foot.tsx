import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { reportStepRoute } from '@/lib/routes';
import { moduleLabel } from '../../tools/module-words';
import type { StepPlace } from '../../tools/step-place';
import { StepLink } from '../shared/step-link';
import { WIZARD_MESSAGES } from '../shared/wizard-messages';
import styles from './step-foot.module.css';

/**
 * The step's foot (task 179.3; `design_spec.md` S-07's amendment of 1 Oct 2026): *Back* to the module before and
 * *Next: B2 — Practices and policies* to the one after, each absent where there is none. Where they lead is the
 * section's `placeOf`, computed once with the heading's position, and it never gates.
 *
 * **A step change by the foot is a step change by the list**: the same `StepLink`, so the session is asked after
 * before the router moves and the queue persists across the change exactly as it does from the rail (task 92).
 *
 * **No sentence about saving** (the owner's choice at task 179's review, 1 Oct 2026): the artboard's *nothing to save*
 * stood on a locked report and beside a failed save, where it was untrue, and UX-35 gives save state one place — the
 * bar's indicator.
 *
 * **Two wordings of *Next*, one shown**: the module's name at `wide` and its reference alone below it, as the 834 and
 * 390 frames draw it. Each is a whole message (UX-95), and the hidden one is `display: none`, so the link's accessible
 * name is the words a reader sees. *Back* names its module at every width: *Back* alone is a link a screen reader lists
 * without saying where it goes (WCAG 2.4.4).
 */
export async function StepFoot({
  reportId,
  place,
}: {
  readonly reportId: string;
  readonly place: Pick<StepPlace, 'previous' | 'next'>;
}) {
  const t = await getTranslations(WIZARD_MESSAGES);
  const { previous, next } = place;

  return (
    <div className={styles.foot}>
      {previous === null ? null : (
        <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
          <StepLink href={reportStepRoute({ reportId, module: previous })}>
            {t('step.foot.back', { module: previous })}
          </StepLink>
        </Button>
      )}
      {next === null ? null : (
        <Button asChild variant={BUTTON_VARIANT.PRIMARY} className={styles.next}>
          <StepLink href={reportStepRoute({ reportId, module: next })}>
            <span className={styles.wide}>{t('step.foot.next', { label: moduleLabel(t, next) })}</span>
            <span className={styles.narrow}>{t('step.foot.nextShort', { module: next })}</span>
          </StepLink>
        </Button>
      )}
    </div>
  );
}
