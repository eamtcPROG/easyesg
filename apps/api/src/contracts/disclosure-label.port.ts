import type { DisclosureLabel, LabelStanding, Locale } from '@easyesg/i18n';

/**
 * Disclosure label resolution, behind a port (P-7, FR-63, FR-64; task 33.2).
 *
 * **It is in `contracts/` for the same reason `taxonomy-registry.port.ts` is**: `platform/localization`
 * owns it, and its consumers are elsewhere — the wizard renders a module's fields (task 36), the
 * validation interpreter names the disclosure a finding is about (task 40), and the PDF and Excel
 * exports label every row (tasks 44 and 46). A consumer importing the service directly would make
 * the *origin* of the wording a transitive dependency of all three.
 *
 * **The origin is exactly what this hides, and OQ-43 is why.** Catalogue text ships in the release
 * today; help-centre articles and plan copy live in the configuration store. `MessageLoader`'s own
 * docblock records that a key may later move from one to the other "without touching a single call
 * site" — that is only true where every call site depends on an interface rather than on an import
 * path, and this is that interface for disclosure labels.
 *
 * **Every method takes the version it is asking about**, exactly as `TaxonomyRegistry` does, and for
 * the same reason: DR-4 makes two versions coexist by design, and a report pinned to the older one
 * must render *its* wording years later. There is no version-agnostic accessor, because that is the
 * shape that silently relabels an archived report.
 *
 * **There is no `standard` parameter, and that is a reading rather than an omission.** The catalogues
 * are laid out `catalogues/disclosure/<version>/`, with no directory level for a standard, because
 * one standard is registered (VSME) and OQ-45 made a version identifier EFRAG's own release date.
 * Adding the parameter would model a second standard nobody has asked for — the widening CLAUDE.md's
 * open-question protocol forbids — and the day one arrives it is a directory level and a migration,
 * not a parameter that was already there.
 */
export interface DisclosureLabelResolver {
  /**
   * One element's label and its provenance, or `null` when the version is not registered or the
   * element is not part of it.
   *
   * **Text and standing arrive together and cannot be separated.** UX-47 and UX-98 require a reader
   * to be told when the labels in front of them are platform-authored rather than EFRAG's own — at
   * export language selection and on the exported document. An accessor answering a bare string
   * would make that statement something each surface has to remember, and the export worker (task
   * 46.3) has no other reason to know which locales EFRAG publishes.
   */
  label(query: {
    readonly version: string;
    readonly locale: Locale;
    readonly key: string;
  }): DisclosureLabel | null;

  /**
   * Every label of a version in a locale, keyed by element key — what rendering a module needs, so a
   * form with forty fields asks once. `null` for an unregistered version rather than an empty map,
   * which a caller reads as "this version has no elements".
   */
  labels(query: {
    readonly version: string;
    readonly locale: Locale;
  }): Readonly<Record<string, DisclosureLabel>> | null;

  /**
   * Whether a version's labels in a locale are EFRAG's own (NFR-24, T-14) — the fact UX-47's export
   * dialogue states before a reporter chooses a language, and `null` where nothing is registered.
   *
   * Separate from `label` for the access pattern: the dialogue asks once per offered language and
   * has no element in hand, so requiring one would mean picking an arbitrary element to ask about.
   */
  standing(query: { readonly version: string; readonly locale: Locale }): LabelStanding | null;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const DISCLOSURE_LABELS = Symbol('DISCLOSURE_LABELS');
