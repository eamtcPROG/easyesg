import type { Locale } from '@easyesg/i18n';
import { sanitizeReturnPath } from '@/lib/locale-path';
import { choosesOrganization, completesAccountSetup, requiresSession } from '@/lib/route-access';
import { ROUTES } from '@/lib/routes';

export interface ChoiceExit {
  readonly href: string;
  /** The return path's own locale where it named one, which the URL makes authoritative (OQ-32). */
  readonly locale?: Locale;
}

/**
 * Where S-37 sends a reader once an organization is chosen (task 83.3; `design_spec.md` S-37's exits).
 *
 * **The address that sent them here, where a chosen organization lets them go** — any address needing a
 * session, which every screen an organization scopes is — **and S-05 otherwise.** Two such addresses are
 * refused, each because it would turn the reader round: S-37 itself, and S-36, which an account holding
 * memberships has already completed. An address needing no session is not refused so much as never
 * expected: §4.3's branch honours those itself and does not carry them here.
 *
 * **Sanitised rather than trusted**, because `?return=` is the reader's to edit: a protocol-relative
 * `//elsewhere` is not an address in this app, and `sanitizeReturnPath` refuses it.
 */
export const choiceExit = (returnTo: string | undefined): ChoiceExit => {
  const path = sanitizeReturnPath(returnTo);
  if (
    path !== null &&
    requiresSession(path.href) &&
    !choosesOrganization(path.href) &&
    !completesAccountSetup(path.href)
  ) {
    return path.locale === undefined ? { href: path.href } : { href: path.href, locale: path.locale };
  }
  return { href: ROUTES.HOME };
};
