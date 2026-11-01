'use client';

import { BUTTON_VARIANT, Button, CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { COOKIE_CHOICE_MESSAGES } from '../shared/cookie-choice-messages';
import styles from './cookie-banner.module.css';
import { useReservedBlock } from './use-reserved-block';

const TITLE_ID = 'cookie-banner-title';

/**
 * S-31's banner (task 223; `design_spec.md` S-31, OQ-27) — the Public Legal artboard's *first visit banner*, with the
 * one answer there is: *I understand*, beside *Cookie settings*. A region at the foot of the viewport that blocks
 * nothing — the page reserves its height (`useReservedBlock`) — so a reader who has not answered can still read the
 * whole page, the privacy notice included.
 *
 * **No decline**, and that is the decision rather than a gap (OQ-27): every cookie is strictly necessary, so declining
 * would set exactly what understanding sets.
 */
export function CookieBanner({
  saving,
  failed,
  onUnderstood,
  onSettings,
}: {
  readonly saving: boolean;
  readonly failed: boolean;
  readonly onUnderstood: () => Promise<void>;
  readonly onSettings: () => void;
}) {
  const t = useTranslations(COOKIE_CHOICE_MESSAGES);
  const ref = useRef<HTMLElement>(null);
  useReservedBlock(ref);

  return (
    <section ref={ref} className={styles.banner} aria-labelledby={TITLE_ID}>
      <div className={styles.inner}>
        <div className={styles.text}>
          <h2 id={TITLE_ID} className="t-heading-3">
            {t('banner.title')}
          </h2>
          <p className={styles.body}>
            {t.rich('banner.body', {
              policy: (chunks) => (
                <TextLink asChild>
                  <Link href={ROUTES.LEGAL_COOKIES}>{chunks}</Link>
                </TextLink>
              ),
            })}
          </p>
          {failed ? (
            <Callout intent={CALLOUT_INTENT.ERROR} title={t('failed.title')} action={null}>
              {t('failed.body')}
            </Callout>
          ) : null}
        </div>
        <div className={styles.actions}>
          <Button variant={BUTTON_VARIANT.PRIMARY} busy={saving} onClick={() => void onUnderstood()}>
            {t('banner.understood')}
          </Button>
          <Button variant={BUTTON_VARIANT.SECONDARY} disabled={saving} onClick={onSettings}>
            {t('banner.settings')}
          </Button>
        </div>
      </div>
    </section>
  );
}
