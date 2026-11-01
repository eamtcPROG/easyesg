import type { DisclosureDefault } from '../models/wizard-step.model';

/**
 * The answers EFRAG's template ships a field already holding — configuration, read through a port.
 *
 * `Derivations`' reasoning, and the same correction: the step read asks *what does the template
 * answer for me*, and the configuration store, the revision cache and the fail-closed read are the
 * adapter's. Added 9 Sep 2026 by task 36's parent-close convention review.
 */
export interface TemplateDefaults {
  /** The template's own answers, by element. Empty where nothing is registered, which is not a defect. */
  all(query: { readonly standard: string }): ReadonlyMap<string, DisclosureDefault>;
}

export const TEMPLATE_DEFAULTS = Symbol('TEMPLATE_DEFAULTS');
