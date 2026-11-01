import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout } from '@easyesg/ui';
import { useTranslations } from 'use-intl';

/**
 * §8.1's *error — recoverable* for A-02: the read did not produce a usable answer — the api was
 * unreachable, or it answered something the screen cannot use — so nothing is shown and nothing is
 * guessed. NFR-79's three parts, with the retry as the *what now*.
 */
export function RegisterUnavailable({ onRetry }: { readonly onRetry: () => void }) {
  const t = useTranslations('platform.organizations.unavailable');

  return (
    <div className="p-[var(--space-6)]">
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('title')}
        action={
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={onRetry}>
            {t('action')}
          </Button>
        }
      >
        {t('body')}
      </Callout>
    </div>
  );
}
