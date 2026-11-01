import { Button, BUTTON_VARIANT, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { reportCalculatorRoute } from '@/lib/routes';
import { StepLink } from '@/features/wizard/components/shared/step-link';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';
import styles from '../styles/calculator.module.css';

/**
 * S-09's way in from B3 (task 39.2; `design_spec.md` S-09's *entry points: S-07 from the B3 module step*; the
 * artboard's 8.1, *"don't have this in tonnes? Almost nobody does"*): above B3's fields, once for both scopes, because
 * the same bills answer Scope 1 and Scope 2 and the calculator opens from either.
 *
 * **Not a field's own control**: a reader whose accountant already has the tonnes types them into the fields below and
 * never opens it, which is the artboard's *"or type the figure"*. Read by S-07's section, on B3 only — the one module
 * the calculator answers — which is why it lives here, beside the screen it opens, rather than in the wizard's tree.
 */
export async function CalculatorEntry({ reportId }: { readonly reportId: string }) {
  const t = await getTranslations(`${CALCULATOR_MESSAGES}.entry`);
  return (
    <div className={styles.entry}>
      <Callout
        intent={CALLOUT_INTENT.INFO}
        title={t('title')}
        action={
          <Button asChild variant={BUTTON_VARIANT.SECONDARY}>
            <StepLink href={reportCalculatorRoute({ reportId })}>{t('action')}</StepLink>
          </Button>
        }
      >
        {t('body')}
      </Callout>
    </div>
  );
}
