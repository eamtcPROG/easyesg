/**
 * The platform's operator as A-21 publishes it (task 75), read by a module that is not `platform/legal` — the
 * notification module, whose emails name the operator in their footer (task 225; §12.5.6's task-225 row (7)).
 *
 * **It answers `null` rather than refusing**: the legal pages refuse to render without a controller, because a privacy
 * notice naming nobody is worse than none, while an email without its operator line is still the email a recipient
 * needs. The choice of what an absence means is the caller's, so the port carries the absence and no error.
 */
export interface OperatorIdentity {
  readonly registeredName: string;
  readonly registeredAddress: string;
}

export interface LegalOperator {
  inForce(): OperatorIdentity | null;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const LEGAL_OPERATOR = Symbol('LEGAL_OPERATOR');
