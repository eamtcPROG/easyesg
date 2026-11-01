import type { DisclosureLabel } from '@easyesg/i18n';

/**
 * One locale's help for a taxonomy version, from its two sources (task 94; UX-17, `architecture.md` §12.5.6's task-94
 * row).
 *
 * **Two sources, and which one an entry came from is its standing.** `help/` holds EFRAG's own `documentation`
 * labels, which `extract-vsme-labels.mjs` writes and which carry the locale's standing — official in English.
 * `help/platform/` holds what this platform wrote for every element EFRAG documents nothing for, and is
 * platform-authored in every locale, English included. The caller pairs each source with its standing; this joins
 * them.
 *
 * **A key in both is refused, not resolved.** Either answer would be a decision taken silently: preferring EFRAG's
 * drops the platform's sentence, which for the omitted-disclosures element is the statement UX-30 owes the reader;
 * preferring the platform's puts an authored sentence in front of an official one, against NFR-24. So the overlap
 * fails the module's load, which is when a release that started documenting an element the platform already covers
 * becomes visible — and somebody decides which sentence a reader sees.
 */
export function joinHelp(sources: {
  readonly version: string;
  readonly locale: string;
  readonly documented: Readonly<Record<string, DisclosureLabel>>;
  readonly authored: Readonly<Record<string, DisclosureLabel>>;
}): Readonly<Record<string, DisclosureLabel>> {
  const both = Object.keys(sources.authored).filter((key) => Object.hasOwn(sources.documented, key));
  if (both.length > 0) {
    throw new Error(
      `help for ${both.join(', ')} at ${sources.version} in ${sources.locale} is both EFRAG's and the platform's — ` +
        'one element has one help sentence, and which one a reader sees is a decision',
    );
  }
  return { ...sources.documented, ...sources.authored };
}
