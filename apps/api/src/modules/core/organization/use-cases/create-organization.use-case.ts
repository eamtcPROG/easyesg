import type { Organization } from '../models/organization.model';
import type { OrganizationFoundingStore } from '../interfaces/organization-founding-store.interface';
import type { OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';
import { CountryNotSupportedError } from '../errors/organization.errors';

/**
 * UC-49's command. One object, per CLAUDE.md — and here the rule earns itself twice: `name` and
 * `countryCode` are adjacent strings a positional call could swap into an organization called `MD`
 * in a country called *Fabrica de Cașcaval*, and `founderAccountId` is ambient request context the
 * controller never sends, so the DTO is `Omit`ed rather than restated.
 */
export interface CreateOrganizationCommand {
  readonly name: string;
  readonly countryCode: string;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  /** Resolved from the session by the service — never from the body (D-1: the *creator* is the OA). */
  readonly founderAccountId: string;
  /**
   * The session to point at the new organization. Ambient context like `founderAccountId`, and
   * never from the body: a caller who could name a session id would move somebody else's active
   * organization.
   */
  readonly sessionId: string;
}

/**
 * UC-49 — create an organization, and become its Organization Administrator (FR-13, FR-14, D-1).
 *
 * **The founding grant is not in this class**, and that placement is the requirement rather than a
 * layering preference. FR-13 makes the role automatic, so the two writes must commit together or
 * the organization is unreachable by everyone including its creator; a use case orchestrating two
 * store calls could not promise that, since it has no transaction to hold them in. The store port
 * takes both facts and says so in its own header.
 *
 * **The country check is here rather than in the DTO**, because it is a question about registered
 * configuration and not about the shape of the request — a `@IsIn` would need the vocabulary at
 * class-decoration time, which is before the store has polled, and would freeze at boot the list
 * AD-4 exists to let move at runtime.
 */
export class CreateOrganization {
  constructor(
    private readonly store: OrganizationFoundingStore,
    private readonly vocabulary: OrganizationVocabulary,
  ) {}

  async execute(command: CreateOrganizationCommand): Promise<Organization> {
    // ISO renders alpha-2 upper case and the column stores it that way; accepting `md` and storing
    // `MD` is the courtesy, and normalising here rather than in the DTO keeps one spelling reaching
    // both the vocabulary lookup and the row.
    const countryCode = command.countryCode.toUpperCase();

    // `null`, not empty: §7.2's stated boundary is *no vocabulary registered*, which means the
    // platform does not operate there yet. A registered-but-empty list is a misconfiguration, and
    // the port keeps the two apart so this refusal cannot be reached by an editing mistake.
    if (this.vocabulary.legalFormsFor(countryCode) === null) throw new CountryNotSupportedError();

    return this.store.createWithFoundingAdministrator({
      organization: {
        name: command.name,
        countryCode,
        contactEmail: command.contactEmail,
        contactPhone: command.contactPhone,
      },
      founderAccountId: command.founderAccountId,
      sessionId: command.sessionId,
    });
  }
}
