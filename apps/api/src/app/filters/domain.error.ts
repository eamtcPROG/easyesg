import { ProblemTypeSlug } from './problem-types';

/**
 * Base for errors that map to a registered problem type.
 *
 * Domain and use-case code throws these. It must not throw HttpException — that would put a
 * NestJS type inside the layers CLAUDE.md forbids it in, and the mapping from domain failure to
 * HTTP status is an interface-adapter concern.
 *
 * **It carries a message KEY, never a sentence** (architecture.md OQ-43). A literal here would
 * be user-facing wording living in a `.ts` file, invisible to the parity gate and to every
 * translator, and it would arrive in whatever language the developer happened to be thinking in
 * while the reader is an SME owner reading Romanian or Russian. `ProblemDetailsFilter` resolves
 * the key against the negotiated locale (OQ-46).
 *
 * The key is passed to `Error` as its message so a server log, a stack trace and an APM span
 * still identify the failure. That surface is developer-facing and stays untranslated on
 * purpose — it is the one place the key is the useful thing to read.
 */
export abstract class DomainError extends Error {
  abstract readonly problemType: ProblemTypeSlug;
  abstract readonly status: number;

  /**
   * Catalogue key for the problem document's `detail`, resolved at the edge. Expected to carry
   * NFR-79's three parts — what failed, the consequence, the action that resolves it.
   */
  readonly messageKey: string;

  /** ICU placeholders for `messageKey`. Named, never concatenated fragments (UX-95). */
  readonly params?: Record<string, unknown>;

  /** Extension members merged into the problem document (e.g. limit, allowance). */
  readonly extensions: Record<string, unknown> = {};

  protected constructor(
    messageKey: string,
    params?: Record<string, unknown>,
    extensions: Record<string, unknown> = {},
  ) {
    super(messageKey);
    this.name = new.target.name;
    this.messageKey = messageKey;
    this.params = params;
    this.extensions = extensions;
  }
}
