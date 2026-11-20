import type { Locale } from '@easyesg/i18n';

/**
 * The locales the platform offers a reader (task 67.16; FR-63 behaviour 6; 182/46) — built **and** registered, the
 * registration being the `locale_registration` artefact `platform/localization` reads. In `contracts/` because its
 * reader is elsewhere: the export dialogue's languages (`core/export`). The tenant interface's own language choices
 * reading it is task 252's (§12.5.6's task-67.16 row (3)).
 */
export interface LocaleOffer {
  /** Every offered locale, the build registry's order kept. */
  offered(): readonly Locale[];
}

export const LOCALE_OFFER = Symbol('LOCALE_OFFER');

/** The kind and scope of the registration artefact — one slot, read by the offer and judged at publication. */
export const LOCALE_REGISTRATION_CONFIG_KIND = 'locale_registration';
export const LOCALE_REGISTRATION_SCOPE = 'global';
