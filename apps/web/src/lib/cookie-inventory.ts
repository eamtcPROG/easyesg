import { COOKIE_CHOICE_KEPT_MONTHS } from '@easyesg/i18n';
import {
  COOKIE_CHOICE_COOKIE,
  FACTOR_CHALLENGE_COOKIE,
  FACTOR_CHALLENGE_TTL_SECONDS,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
  PENDING_LINK_COOKIE,
  PENDING_LINK_TTL_SECONDS,
  REFRESH_COOKIE,
  SETUP_GRANT_COOKIE,
  SOCIAL_TRANSACTION_COOKIE,
  SOCIAL_TRANSACTION_TTL_MS,
} from '@/lib/session-cookie';

/**
 * Every cookie the platform sets and every browser store that is not a cookie — **the single source of the cookie
 * policy's claim** (task 75.2; 182/122; FR-206). The policy is a factual statement about the build (UC-179), so what it
 * lists is read from here and nowhere else, and `cookie-inventory.spec.ts` fails when the repository declares a cookie,
 * or a module keeps browser storage, this does not list.
 *
 * **The site's seven cookies are imported from where the application declares them** (`lib/session-cookie.ts`), names
 * and the lifetimes this tier decides, so the policy cannot drift from them. **The operator console's two are set by
 * `apps/api`**, on the console's own origin, which `apps/web` may not import; their names are restated here and the spec
 * holds them to the api's source.
 *
 * **Every one is strictly necessary** — the owner's assumption, OQ-23 and 182/122: the platform informs, and since task
 * 223 records that it did (OQ-27), but offers nothing to decline; a cookie that is not strictly necessary brings a real
 * choice in the same change.
 */
export const COOKIE_SURFACE = {
  /** This site — `easyesg.md` and its locales. */
  SITE: 'site',
  /** The operator console, on its own origin, for the platform's own staff. */
  CONSOLE: 'console',
} as const;

export type CookieSurface = (typeof COOKIE_SURFACE)[keyof typeof COOKIE_SURFACE];

/** What each cookie is for — a key of `legal.cookies.purpose`. */
export const COOKIE_PURPOSE = {
  SESSION: 'session',
  LOCALE: 'locale',
  SOCIAL: 'social',
  FACTOR_CHALLENGE: 'factorChallenge',
  PENDING_LINK: 'pendingLink',
  SETUP_GRANT: 'setupGrant',
  /** Task 223: the answer to the cookie banner. */
  COOKIE_CHOICE: 'cookieChoice',
  ADMIN_SESSION: 'adminSession',
  ADMIN_CHALLENGE: 'adminChallenge',
} as const;

export type CookiePurpose = (typeof COOKIE_PURPOSE)[keyof typeof COOKIE_PURPOSE];

/** How long a cookie lasts, in the terms the policy states it — a key of `legal.cookies.lifetime`. */
export const COOKIE_LIFETIME = {
  /** As long as the session it holds: until sign-out, or until the browser closes unless the reader stays signed in. */
  WHILE_SIGNED_IN: 'whileSignedIn',
  /** A fixed number of minutes, which this tier sets. */
  MINUTES: 'minutes',
  /** next-intl's browser-session cookie, written for a year once a profile's language is remembered. */
  SESSION_THEN_YEAR: 'sessionThenYear',
  /** As long as the step it belongs to — an expiry the api sets, a few minutes. */
  UNTIL_STEP_ENDS: 'untilStepEnds',
  /** A fixed number of calendar months from when it was set — the cookie banner's answer (task 223). */
  MONTHS: 'months',
} as const;

export type CookieLifetime =
  | { readonly kind: typeof COOKIE_LIFETIME.WHILE_SIGNED_IN }
  | { readonly kind: typeof COOKIE_LIFETIME.MINUTES; readonly minutes: number }
  | { readonly kind: typeof COOKIE_LIFETIME.SESSION_THEN_YEAR; readonly years: number }
  | { readonly kind: typeof COOKIE_LIFETIME.UNTIL_STEP_ENDS }
  | { readonly kind: typeof COOKIE_LIFETIME.MONTHS; readonly months: number };

export interface InventoriedCookie {
  readonly name: string;
  readonly surface: CookieSurface;
  readonly purpose: CookiePurpose;
  readonly lifetime: CookieLifetime;
}

const SECONDS_PER_YEAR = 60 * 60 * 24 * 365;

const minutes = (seconds: number): CookieLifetime => ({ kind: COOKIE_LIFETIME.MINUTES, minutes: seconds / 60 });

export const COOKIE_INVENTORY: readonly InventoriedCookie[] = [
  {
    name: REFRESH_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.SESSION,
    lifetime: { kind: COOKIE_LIFETIME.WHILE_SIGNED_IN },
  },
  {
    name: LOCALE_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.LOCALE,
    lifetime: { kind: COOKIE_LIFETIME.SESSION_THEN_YEAR, years: LOCALE_COOKIE_MAX_AGE_SECONDS / SECONDS_PER_YEAR },
  },
  {
    name: SOCIAL_TRANSACTION_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.SOCIAL,
    lifetime: minutes(SOCIAL_TRANSACTION_TTL_MS / 1000),
  },
  {
    name: FACTOR_CHALLENGE_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.FACTOR_CHALLENGE,
    lifetime: minutes(FACTOR_CHALLENGE_TTL_SECONDS),
  },
  {
    name: PENDING_LINK_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.PENDING_LINK,
    lifetime: minutes(PENDING_LINK_TTL_SECONDS),
  },
  {
    name: SETUP_GRANT_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.SETUP_GRANT,
    lifetime: { kind: COOKIE_LIFETIME.UNTIL_STEP_ENDS },
  },
  {
    name: COOKIE_CHOICE_COOKIE,
    surface: COOKIE_SURFACE.SITE,
    purpose: COOKIE_PURPOSE.COOKIE_CHOICE,
    lifetime: { kind: COOKIE_LIFETIME.MONTHS, months: COOKIE_CHOICE_KEPT_MONTHS },
  },
  {
    name: 'easyesg_admin_session',
    surface: COOKIE_SURFACE.CONSOLE,
    purpose: COOKIE_PURPOSE.ADMIN_SESSION,
    lifetime: { kind: COOKIE_LIFETIME.WHILE_SIGNED_IN },
  },
  {
    name: 'easyesg_admin_challenge',
    surface: COOKIE_SURFACE.CONSOLE,
    purpose: COOKIE_PURPOSE.ADMIN_CHALLENGE,
    lifetime: { kind: COOKIE_LIFETIME.UNTIL_STEP_ENDS },
  },
];

/** The cookies this site sets, by name — what S-31's settings say *Necessary* holds (task 223). */
export const SITE_COOKIE_NAMES: readonly string[] = COOKIE_INVENTORY.filter(
  (cookie) => cookie.surface === COOKIE_SURFACE.SITE,
).map((cookie) => cookie.name);

/** The two kinds of browser storage the site keeps that are not cookies — a key of `legal.cookies.storageKind`. */
export const STORAGE_KIND = {
  /** Kept for the tab's session and gone when it closes. */
  SESSION_STORAGE: 'sessionStorage',
  /** Kept in the browser's database until the work it holds is sent. */
  INDEXED_DB: 'indexedDb',
} as const;

export type StorageKind = (typeof STORAGE_KIND)[keyof typeof STORAGE_KIND];

/** What each store holds — a key of `legal.cookies.storagePurpose`. */
export const STORAGE_PURPOSE = {
  PENDING_VERIFICATION: 'pendingVerification',
  RESET_ADDRESS: 'resetAddress',
  DISMISSED_NOTES: 'dismissedNotes',
  AUTOSAVE: 'autosave',
} as const;

export type StoragePurpose = (typeof STORAGE_PURPOSE)[keyof typeof STORAGE_PURPOSE];

export interface InventoriedStore {
  readonly kind: StorageKind;
  readonly purpose: StoragePurpose;
  /** The module that keeps it, from the repository's root — what the spec holds against the source. */
  readonly module: string;
}

export const BROWSER_STORAGE: readonly InventoriedStore[] = [
  {
    kind: STORAGE_KIND.SESSION_STORAGE,
    purpose: STORAGE_PURPOSE.PENDING_VERIFICATION,
    module: 'apps/web/src/features/identity/shared/store/pending-verification-store.ts',
  },
  {
    kind: STORAGE_KIND.SESSION_STORAGE,
    purpose: STORAGE_PURPOSE.RESET_ADDRESS,
    module: 'apps/web/src/features/identity/shared/store/reset-address-store.ts',
  },
  {
    kind: STORAGE_KIND.SESSION_STORAGE,
    purpose: STORAGE_PURPOSE.DISMISSED_NOTES,
    module: 'apps/web/src/client/applicability/dismissed-notes.ts',
  },
  {
    kind: STORAGE_KIND.INDEXED_DB,
    purpose: STORAGE_PURPOSE.AUTOSAVE,
    module: 'apps/web/src/client/autosave/pending-store.ts',
  },
];
