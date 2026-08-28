import { validateIdno, validateLei } from '@easyesg/validation';
import type { Clock } from '@api/contracts/clock.port';
import type { Organization, OrganizationProfilePatch } from '../models/organization.model';
import type { OrganizationStore } from '../interfaces/organization-store.interface';
import type { OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';
import {
  CountryNotSupportedError,
  IdnoMalformedError,
  LegalFormUnknownError,
  LeiCheckDigitsError,
  LeiMalformedError,
  OrganizationNotFoundError,
} from '../errors/organization.errors';

/** UC-50's command. One object, and the patch is nested so `patch.name` cannot be read as the org's. */
export interface UpdateOrganizationProfileCommand {
  readonly patch: OrganizationProfilePatch;
}

/**
 * UC-50's edit half (FR-15) — legal form, registered name, registered address and contact details.
 *
 * **The legal form is checked against the country the patch RESULTS IN, not the stored one**, and
 * that is the only interesting line in this class. The vocabulary is scoped by country (§7.2), so
 * three requests reach the same refusal by different routes: setting an unregistered form; moving
 * the organization to a country whose vocabulary lacks the form it already holds; and doing both at
 * once. Checking against the stored country would pass the second and leave a row holding a value no
 * list contains — visible nowhere until S-15 renders a select with nothing selected.
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
    const registeredForms = this.vocabulary.legalFormsFor(countryCode);
    if (registeredForms === null) throw new CountryNotSupportedError();

    // `undefined` means "absent from the patch", `null` means "clear it" — the model's own
    // distinction, and the reason this reads `!== undefined` rather than `??`. Clearing a legal form
    // is always permitted: an organization that has not decided is a state S-15 has to be able to
    // return to, and refusing it would make a wrong choice unfixable.
    const legalForm =
      command.patch.legalForm !== undefined ? command.patch.legalForm : current.legalForm;
    if (legalForm !== null && !registeredForms.includes(legalForm)) {
      throw new LegalFormUnknownError();
    }

    // ── FR-16's identifiers ────────────────────────────────────────────────────────────────
    //
    // **Validated here rather than by a `@Matches` on the DTO**, so the shared rule in
    // `packages/validation` is the only implementation: S-15 shows the same verdict inline as the
    // Administrator types (§9.8), and a second copy in a decorator would be the drift that package
    // exists to prevent. It also lets the refusal distinguish a malformed value from one whose
    // check digits disagree, which a single `@Matches` cannot — and NFR-79 needs those apart,
    // because one says retype it and the other says go back to the register.
    //
    // `null` clears an identifier and is always permitted; `undefined` leaves it alone.
    if (command.patch.idno !== undefined && command.patch.idno !== null) {
      if (!validateIdno(command.patch.idno).shape) throw new IdnoMalformedError();
    }
    if (command.patch.lei !== undefined && command.patch.lei !== null) {
      const verdict = validateLei(command.patch.lei);
      if (!verdict.shape) throw new LeiMalformedError();
      // `checkDigits` is `false` only when the shape passed, so the two refusals cannot overlap.
      if (verdict.checkDigits === false) throw new LeiCheckDigitsError();
    }

    // The normalised country goes back into the patch, so the stored value is what was validated
    // rather than what was typed.
    const patch: OrganizationProfilePatch =
      command.patch.countryCode === undefined ? command.patch : { ...command.patch, countryCode };

    const updated = await this.store.updateProfile(patch, this.now());
    if (!updated) throw new OrganizationNotFoundError();
    return updated;
  }
}
