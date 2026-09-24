'use client';

import { Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { FACTOR_MESSAGES } from '../shared/credentials-messages';

/**
 * An enrolled factor with no recovery codes left (UC-195) — a warning carrying its fix, in the row at rest. The fix
 * opens the row at the re-issue step, the same step *New recovery codes* opens: one action, two ways to it, and the
 * one here is the one the reader is looking at when it matters.
 */
export function FactorExhausted({ onReissue }: { readonly onReissue: () => void }) {
  const t = useTranslations(FACTOR_MESSAGES);

  return (
    <Callout
      intent={CALLOUT_INTENT.ATTENTION}
      title={t('noCodesTitle')}
      action={
        <Button type="button" onClick={onReissue}>
          {t('reissue')}
        </Button>
      }
    >
      {t('noCodesBody')}
    </Callout>
  );
}
