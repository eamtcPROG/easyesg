import { Injectable, Logger } from '@nestjs/common';
import type { DisclosureLabel, LabelStanding, Locale } from '@easyesg/i18n';
import type { DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { DISCLOSURE_CATALOGUES } from '../constants/disclosure-catalogues';

/**
 * `DisclosureLabelResolver` over the committed catalogues — the adapter half of OQ-43 for VSME
 * wording (task 33.2).
 *
 * **Deliberately thin, and the thinness is where the guarantee is *not*.** The catalogues are
 * committed data with a parity suite over them, so at runtime a key that came from the taxonomy
 * registry always resolves; there is nothing to validate that a spec cannot assert far more cheaply.
 * `disclosure-label.artefact.spec.ts` beside this folder is that spec — it holds the registered
 * taxonomy and the catalogues against each other in all three locales, which is the build-time gate
 * on the only defect that matters: an element with no label renders as a field with no name, and
 * **nothing in the interface would say so.** UX-97 prohibits a visible "missing translation" marker
 * for the case it governs — a string that *fell back* to the source locale — and this is not that
 * case: the resolver falls back to nothing and answers `null`. No marker exists for it either, so
 * the blank is silent by omission rather than by rule, which is the weaker guarantee of the two.
 *
 * **What it does add is the operator signal.** A miss is logged at `error` before `null` is
 * returned, matching `TaxonomyRegistryService`'s degrade-and-log design — because the alternative to
 * a blank-but-loud field is a blank-but-silent one, and by the time a reporter notices, the export
 * has been filed.
 *
 * **No caching**, unlike the registry. That reads a configuration store and rebuilds 143 elements
 * plus 973 axis members per revision; every accessor here is a property lookup on an object frozen
 * into the module graph at load, so a cache would be a map in front of a map. **That is true because
 * `disclosure-catalogues.ts` pairs each label with its standing once, at load** — the first draft
 * built 143 `{ text, standing }` objects inside `labels()`, which is the accessor a forty-field form
 * calls, and this sentence was wrong about it.
 */
@Injectable()
export class DisclosureLabelService implements DisclosureLabelResolver {
  private readonly logger = new Logger(DisclosureLabelService.name);

  label(query: {
    readonly version: string;
    readonly locale: Locale;
    readonly key: string;
  }): DisclosureLabel | null {
    const label = DISCLOSURE_CATALOGUES[query.version]?.labels[query.locale]?.[query.key];
    if (label === undefined) {
      // Names the version and the locale as well as the key: the same key resolves under one
      // version and not another, which is the point of DR-4 and the first thing an operator needs
      // in order to tell a bad pin from a bad catalogue.
      this.logger.error(
        `no label for element ${query.key} at ${query.version} in ${query.locale} — a disclosure will render unnamed`,
      );
      return null;
    }
    return label;
  }

  labels(query: {
    readonly version: string;
    readonly locale: Locale;
  }): Readonly<Record<string, DisclosureLabel>> | null {
    const labels = DISCLOSURE_CATALOGUES[query.version]?.labels[query.locale];
    if (labels === undefined) {
      this.logger.error(`no label catalogue for ${query.version} in ${query.locale}`);
      return null;
    }
    return labels;
  }

  help(query: {
    readonly version: string;
    readonly locale: Locale;
    readonly key: string;
  }): DisclosureLabel | null {
    // Not logged: absence is the ordinary case (22 of 143 at `2026-05-01`), and a field with no
    // help is a field with no help, not a catalogue defect.
    return DISCLOSURE_CATALOGUES[query.version]?.help[query.locale]?.[query.key] ?? null;
  }

  memberLabels(query: {
    readonly version: string;
    readonly locale: Locale;
  }): Readonly<Record<string, DisclosureLabel>> | null {
    const members = DISCLOSURE_CATALOGUES[query.version]?.members[query.locale];
    if (members === undefined) {
      this.logger.error(`no member catalogue for ${query.version} in ${query.locale}`);
      return null;
    }
    return members;
  }

  standing(query: { readonly version: string; readonly locale: Locale }): LabelStanding | null {
    // Not logged. An unregistered version is already reported by whichever accessor tried to read
    // it, and UX-47's dialogue asks this once per offered language — logging here would turn one
    // bad pin into a line per locale every time the dialogue opens.
    return DISCLOSURE_CATALOGUES[query.version]?.standing[query.locale] ?? null;
  }
}
