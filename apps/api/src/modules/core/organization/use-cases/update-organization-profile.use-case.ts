import type { Clock } from '@api/contracts/clock.port';
import type { Organization, OrganizationProfilePatch } from '../models/organization.model';
import type { OrganizationStore } from '../interfaces/organization-store.interface';
import type { OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';
import { CountryNotSupportedError, OrganizationNotFoundError } from '../errors/organization.errors';

/** UC-50's command. One object, and the patch is nested so `patch.name` cannot be read as the org's. */
export interface UpdateOrganizationProfileCommand {
  readonly patch: OrganizationProfilePatch;
}

/**
 * UC-50's edit half (FR-15) — the account's name, its country and the contact the platform writes to.
 *
 * **The country must register a vocabulary**, since it is what the organization's entities are held to (§7.2). The
 * legal form this class used to check against the resulting country is each entity's since task 177, and a country
 * move is not checked against the entities' forms: one country registers a vocabulary, so no move between two is
 * possible yet — §12.5.6's task-177 row records the deferral and what the second registered country must add.
 *
 * **Attribution and the timestamp are deliberately absent from this class.** FR-15 requires every
 * change attributed and timestamped, and `core.capture_field_change` already writes one row per
 * column that moved, taking its actor from `app.current_user`. Building a second history here would
 * be a trail that can disagree with the one an assurance reviewer reads.
 */
export class UpdateOrganizationProfile {
  constructor(
    private readonly store: OrganizationStore,
    private readonly vocabulary: OrganizationVocabulary,
    private readonly now: Clock,
  ) {}

  async execute(command: UpdateOrganizationProfileCommand): Promise<Organization> {
    const current = await this.store.findBoundOrganization();
    if (!current) throw new OrganizationNotFoundError();

    const countryCode = command.patch.countryCode?.toUpperCase() ?? current.countryCode;
    if (this.vocabulary.legalFormsFor(countryCode) === null) throw new CountryNotSupportedError();

    // The normalised country goes back into the patch, so the stored value is what was validated
    // rather than what was typed.
    const patch: OrganizationProfilePatch =
      command.patch.countryCode === undefined ? command.patch : { ...command.patch, countryCode };

    const updated = await this.store.updateProfile(patch, this.now());
    if (!updated) throw new OrganizationNotFoundError();
    return updated;
  }
}
