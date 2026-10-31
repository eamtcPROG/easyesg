'use client';

import { CALLOUT_INTENT, Callout, TextLink } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Link } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';
import { CONTACT_MESSAGES } from '../shared/contact-messages';

/**
 * S-34's `ready — sent` (task 77): the reference the reader quotes — a reference shown on purpose, which the
 * user-facing-text rule permits — and the way back to the library. **Focus moves to it** when it replaces the form, so a
 * keyboard or screen-reader reader is told the request went rather than left on a field that is gone.
 */
export function ContactSent({ reference }: { readonly reference: string }) {
  const t = useTranslations(CONTACT_MESSAGES);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => region.current?.focus(), []);

  return (
    <div ref={region} tabIndex={-1}>
      <Callout
        intent={CALLOUT_INTENT.SUCCESS}
        title={t('sent.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HELP_CENTRE}>{t('sent.action')}</Link>
          </TextLink>
        }
      >
        {t('sent.body', { reference })}
      </Callout>
    </div>
  );
}
