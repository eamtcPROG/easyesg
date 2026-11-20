/**
 * A publication or a review step that names a slot with no draft in the state it needs (tasks 67.14, 67.15) — no open
 * draft to submit, or none in review to publish. An infrastructure error, as `ConfigurationRevisionMismatchError` is:
 * the store is generic and the screen that drafts maps it onto its own refusal.
 */
export class ConfigurationDraftMissingError extends Error {
  constructor(
    readonly slot: {
      readonly kind: string;
      readonly scope: string;
      /** What the step needed the draft to be. */
      readonly needed: string;
    },
  ) {
    super(`Configuration ${slot.kind}/${slot.scope} has no draft ${slot.needed}`);
    this.name = 'ConfigurationDraftMissingError';
  }
}
