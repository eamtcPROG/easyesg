import type { Locale } from '@easyesg/i18n';

/**
 * Two facts the wizard's read holds fixed rather than reads — where a member's name comes from when EFRAG's package
 * does not give one.
 *
 * **Here because two files read each**: the use case and `OptionResolver` the country, both resolvers the language.
 * They were declared unexported in `read-wizard-step.use-case.ts` while it held all three, and task 133.2's split is
 * what made them shared.
 */

/**
 * Whose vocabularies name NACE members in the two locales EFRAG does not publish, and classify legal
 * forms into EFRAG's five (task 91.2). **Fixed to Moldova rather than read from the report's
 * organization** (task 91.1): both vocabularies are registered per country (§7.2) and only `md`
 * registers either, so there is nothing else to ask for; the day a second country registers one,
 * this becomes a read of the organization's country.
 */
export const VOCABULARY_COUNTRY = 'md';

/**
 * The one language EFRAG publishes the external classifications in (task 36.8).
 *
 * A fact about the package this module reads, not a vocabulary anything else shares. All 973 members of the EU List
 * of Waste carry an `en` label and nothing else — so a Romanian reporter picking a waste entry is shown English, and
 * `DisclosureAxis.memberLanguage` is how the screen learns to say so.
 *
 * **A locale rather than a flag**: the day Romanian names are authored the fallback stops firing and
 * the note disappears on its own, with nothing to remember to turn off.
 */
export const PUBLISHED_CLASSIFICATION_LOCALE: Locale = 'en';
