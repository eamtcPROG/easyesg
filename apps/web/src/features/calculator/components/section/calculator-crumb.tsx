import { ARIA_CURRENT } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { reportStepRoute } from '@/lib/routes';
import { StepLink } from '@/features/wizard/components/shared/step-link';
import { CALCULATOR_MODULE } from '../../tools/calculator-module';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * Where the reader is, above the heading — *B3 — Energy and emissions › Carbon calculator* (§4.7's location for S-09;
 * the artboard's line over the title). **The module is a link back to its step**, the way out that returns to B3 rather
 * than to the top of the report; it is `StepLink`, so the session is asked after before the router moves, as every
 * step change in the wizard is (task 92).
 */
export async function CalculatorCrumb({ reportId, module }: { readonly reportId: string; readonly module: string }) {
  const t = await getTranslations(CALCULATOR_MESSAGES);
  return (
    <nav aria-label={t('crumbLabel')}>
      <ol className={styles.crumb}>
        <li>
          <StepLink href={reportStepRoute({ reportId, module: CALCULATOR_MODULE })} className={styles.crumbLink}>
            {module}
          </StepLink>
        </li>
        <li aria-current={ARIA_CURRENT.PAGE}>{t('crumb')}</li>
      </ol>
    </nav>
  );
}
