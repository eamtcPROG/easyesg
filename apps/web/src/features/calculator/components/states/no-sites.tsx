import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { getTranslations } from 'next-intl/server';
import { reportStepRoute } from '@/lib/routes';
import { StepLink } from '@/features/wizard/components/shared/step-link';
import { CALCULATOR_MESSAGES } from '../shared/calculator-messages';

/**
 * FR-33's precondition, unmet: the report's B1 lists no site, and every line belongs to one (§12.5.6's task-38.1 row
 * (2)). **The way on is B1, where sites are added** — named, because the reader cannot act on *add a site* without
 * knowing where that happens — and reached as any step change is, through `StepLink`.
 */
export async function NoSites({ reportId }: { readonly reportId: string }) {
  const t = await getTranslations(CALCULATOR_MESSAGES);
  return (
    <Callout
      intent={CALLOUT_INTENT.INFO}
      title={t('noSites.title')}
      action={
        <TextLink asChild>
          <StepLink href={reportStepRoute({ reportId, module: B1_MODULE })}>{t('noSites.action')}</StepLink>
        </TextLink>
      }
    >
      {t('noSites.body')}
    </Callout>
  );
}

/** B1 — Basis for preparation, where the report's sites are listed. The standard's own reference. */
const B1_MODULE = 'B1';
