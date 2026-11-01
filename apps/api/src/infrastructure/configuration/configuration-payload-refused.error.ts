/**
 * A publication refused because its payload breaks its kind's rule (task 37.4) — a factor set no run could read.
 *
 * **An infrastructure error, not a `DomainError`**, for `ConfigurationRevisionMismatchError`'s reason: the store is
 * generic and knows no problem type, so the adapter that publishes for a screen maps it onto that screen's refusal —
 * A-05's store onto 400 `validation-failed` (task 67.8). The seed loader lets it throw, so a malformed seed fails
 * `config:seed` with the reason rather than publishing.
 */
export class ConfigurationPayloadRefusedError extends Error {
  constructor(
    readonly refusal: {
      readonly kind: string;
      readonly scope: string;
      /** What is wrong with the payload, in the operator's terms — the rule's own answer. */
      readonly reason: string;
    },
  ) {
    super(`Configuration ${refusal.kind}/${refusal.scope} was not published: ${refusal.reason}`);
    this.name = 'ConfigurationPayloadRefusedError';
  }
}
