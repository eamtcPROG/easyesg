/**
 * A publication refused because its slot no longer holds the revision the caller read (task 67.11).
 *
 * **An infrastructure error, not a `DomainError`**: the configuration store is generic and knows no problem
 * type, so the adapter that publishes for a screen maps it onto that screen's refusal — A-18's store maps it
 * onto `IdentityProviderChangedError`. Without the check, two operators editing one provider would each
 * overwrite what the other had saved, and neither would be told.
 */
export class ConfigurationRevisionMismatchError extends Error {
  constructor(
    readonly slot: {
      readonly kind: string;
      readonly scope: string;
      /** The revision the publication was made against. */
      readonly expected: number;
      /** The revision the slot actually holds; 0 where nothing has been published into it. */
      readonly inForce: number;
    },
  ) {
    super(
      `Configuration ${slot.kind}/${slot.scope} holds revision ${slot.inForce}, not the ${slot.expected} the publication was made against`,
    );
    this.name = 'ConfigurationRevisionMismatchError';
  }
}
