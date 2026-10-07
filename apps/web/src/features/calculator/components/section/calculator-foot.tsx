import { Button, BUTTON_VARIANT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { reportStepRoute } from '@/lib/routes';
import { StepLink } from '@/features/wizard/components/shared/step-link';
import { CALCULATOR_MODULE } from '../../tools/calculator-module';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * Under the calculator: the way back to B3 (§4.7 — *"↩ to origin"*), as S-07's foot draws *Back*. **Nothing is lost by
 * leaving**: every line is in the durable queue the moment it is committed (FR-38), so this is a step change like any
 * other, through `StepLink`.
 */
export async function CalculatorFoot({ reportId, module }: { readonly reportId: string; readonly module: string }) {
  const t = await getTranslations(CALCULATOR_MESSAGES);
  return (
    <div className={styles.foot}>
      <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
        <StepLink href={reportStepRoute({ reportId, module: CALCULATOR_MODULE })}>{t('back', { module })}</StepLink>
      </Button>
    </div>
  );
}
