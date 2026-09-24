import { ROUTES } from '@/lib/routes';

/**
 * The account's two destinations, S-27 and S-28, declared once — `workspace-sections.ts`'s rule for the other half of
 * the rail.
 *
 * **Three readers, which is why this is a module rather than two links written three times**: the account menu in the
 * band, the compact drawer, and the account layout's rail, which the S-27 and S-28 artboards draw below the workspace
 * sections and a rule. Two copies of the pair is how the drawer carried *Credentials* and never *Profile*.
 *
 * `key` is the catalogue key under `chrome.accountMenu` as well as the React key; the label is not here because it is
 * localized, and resolving it is the caller's (UX-79).
 */
export const ACCOUNT_SECTIONS = [
  { key: 'profile', href: ROUTES.ACCOUNT },
  { key: 'credentials', href: ROUTES.ACCOUNT_CREDENTIALS },
] as const;
