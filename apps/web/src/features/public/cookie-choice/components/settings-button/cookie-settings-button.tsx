'use client';

import { useTranslations } from 'next-intl';
import { COOKIE_CHOICE_MESSAGES } from '../shared/cookie-choice-messages';
import { requestCookieSettings } from '../shared/cookie-settings-request';

/**
 * *Cookie settings* in every footer (task 223; `design_spec.md` S-31's entry points; FR-206 behaviour 6) — the
 * artboard's *Cookie choices* beside the legal links. **A button, not a link**: it opens the settings over the page the
 * reader is on, and has no address of its own (the cookie policy is the settings' address).
 *
 * It takes the class of the links beside it, so the row reads as one row of the footer's own kind.
 */
export function CookieSettingsButton({ className }: { readonly className?: string }) {
  const t = useTranslations(COOKIE_CHOICE_MESSAGES);
  return (
    <button type="button" className={className} onClick={requestCookieSettings}>
      {t('settingsButton')}
    </button>
  );
}
