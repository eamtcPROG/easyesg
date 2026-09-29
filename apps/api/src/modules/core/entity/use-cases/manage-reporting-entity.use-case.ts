import { validateIdno, validateLei } from '@easyesg/validation';
import type { Clock } from '@api/contracts/clock.port';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import type { OrganizationStore } from '@api/modules/core/organization/interfaces/organization-store.interface';
import {
  CONSOLIDATION_BASIS,
  ENTITY_STATUS,
  type ConsolidationBasis,
  type NewReportingEntity,
  type ReportingEntity,
  type ReportingEntityPatch,
} from '../models/reporting-entity.model';
import type { ReportingEntityStore } from '../interfaces/reporting-entity-store.interface';
import {
  ConsolidationBoundaryEmptyError,
  EntityArchivedError,
  EntityNotFoundError,
  IdnoMalformedError,
  LegalFormUnknownError,
  LeiCheckDigitsError,
  LeiMalformedError,
  NaceCodeUnknownError,
} from '../errors/entity.errors';

export interface CreateEntityCommand {
  readonly entity: NewReportingEntity;
}
export interface UpdateEntityCommand {
  readonly entityId: string;
  readonly patch: ReportingEntityPatch;
}
export interface ArchiveEntityCommand {
  readonly entityId: string;
}

/**
 * UC-52, UC-53 and UC-55 — create, edit and archive a reporting entity (FR-17, FR-18, FR-20).
 *
 * **One class for the three, because they share the one rule that is not bookkeeping**: an activity
 * code is admitted against the classifier registered for the *organization's* country, and both
 * writes need it. Splitting them into three classes would put `admitNaceCodes` in a helper each
 * imports, which is the same coupling with an extra file.
 *
 * **The country comes from the organization, not from the entity**, and that is worth stating: an
 * entity has sites which may be anywhere, but the classifier that governs its activity codes is the
 * one its organization is registered under. Reading it per call keeps a country change (UC-50)
 * applying to the next entity edit without anything having to invalidate a cache.
 */
export class ManageReportingEntity {
  constructor(
    private readonly store: ReportingEntityStore,
    private readonly organizations: OrganizationStore,
    private readonly vocabulary: OrganizationVocabulary,
    private readonly now: Clock,
  ) {}

  async create(command: CreateEntityCommand): Promise<ReportingEntity> {
    admitIdentifiers(command.entity);
    // FR-19 on a new entity, which has no stored state for the rule to read: what it states is what it results in.
    admitBoundary({
      basis: command.entity.consolidationBasis,
      members: command.entity.consolidationMembers,
    });
    await this.admitNaceCodes(command.entity.naceCodes);
    await this.admitLegalForm(command.entity.legalForm);
    return this.store.create({ entity: command.entity, at: this.now() });
  }

  async update(command: UpdateEntityCommand): Promise<ReportingEntity> {
    const existing = await this.store.findEntity(command.entityId);
    if (!existing) throw new EntityNotFoundError();
    // FR-20: an archived entity's master data is frozen. Read still works — its reports have to
    // stay retrievable — so this is a refusal about state rather than about existence.
    if (existing.status === ENTITY_STATUS.ARCHIVED) throw new EntityArchivedError();

    admitIdentifiers(command.patch);
    if (command.patch.naceCodes !== undefined) await this.admitNaceCodes(command.patch.naceCodes);
    if (command.patch.legalForm !== undefined) await this.admitLegalForm(command.patch.legalForm);

    // FR-19, against the state the patch *results in* rather than the state it arrived at — the
    // same rule shape as the organization's legal form against its resulting country. Three
    // requests reach this refusal: setting the basis with no members stored, clearing the members
    // while the basis stands, and doing both at once.
    admitBoundary({
      basis:
        command.patch.consolidationBasis !== undefined
          ? command.patch.consolidationBasis
          : existing.consolidationBasis,
      members:
        command.patch.consolidationMembers !== undefined
          ? command.patch.consolidationMembers
          : existing.consolidationMembers,
    });

    const updated = await this.store.update({
      entityId: command.entityId,
      patch: command.patch,
      at: this.now(),
    });
    if (!updated) throw new EntityNotFoundError();
    return updated;
  }

  async archive(command: ArchiveEntityCommand): Promise<void> {
    // Idempotent by refusal rather than by silence: archiving an archived entity is a mistake worth
    // reporting, and UC-55 has no un-archive, so it is never a step somebody repeats on purpose.
    const existing = await this.store.findEntity(command.entityId);
    if (!existing) throw new EntityNotFoundError();
    if (existing.status === ENTITY_STATUS.ARCHIVED) throw new EntityArchivedError();

    if (!(await this.store.archive({ entityId: command.entityId, at: this.now() }))) {
      throw new EntityNotFoundError();
    }
  }

  /**
   * A stated legal form must be in the vocabulary registered for the organization's country (§7.2) — the organization's
   * rule until task 177 moved the legal form here. `null` clears it and is always permitted: an entity whose form is not
   * decided yet is a state S-13 must be able to return to.
   */
  private async admitLegalForm(legalForm: string | null): Promise<void> {
    if (legalForm === null) return;

    const organization = await this.organizations.findBoundOrganization();
    if (!organization) throw new EntityNotFoundError();

    if (!(this.vocabulary.legalFormsFor(organization.countryCode) ?? []).includes(legalForm)) {
      throw new LegalFormUnknownError();
    }
  }

  /**
   * Every submitted code must be in the classifier registered for the organization's country.
   *
   * **A country registering no classifier admits nothing**, which is deliberate rather than an
   * oversight: it is the same fail-closed answer `legalFormsFor` gives, and an organization can only
   * exist in a country that registers a legal-form vocabulary anyway (§7.2). An empty `naceCodes`
   * is permitted — FR-17 does not require one, and an entity may be classified later.
   */
  private async admitNaceCodes(codes: readonly string[]): Promise<void> {
    if (codes.length === 0) return;

    const organization = await this.organizations.findBoundOrganization();
    if (!organization) throw new EntityNotFoundError();

    const registered = this.vocabulary.naceCodesFor(organization.countryCode);
    if (!registered) throw new NaceCodeUnknownError();
    // A `Set`, so this is one membership test per code rather than a scan of 996 entries per code.
    for (const code of codes) {
      if (!registered.has(code)) throw new NaceCodeUnknownError();
    }
  }
}

/**
 * FR-16's identifiers, as submitted (task 175 moved them here from the organization's profile with the identifiers).
 *
 * **Validated here rather than by a `@Matches` on the DTO**, so the shared rule in `packages/validation` is the only
 * implementation: S-13 shows the same verdict inline as the Administrator types (§9.8), and a second copy in a
 * decorator would be the drift that package exists to prevent. It also lets the refusal tell a malformed value from
 * one whose check digits disagree, which NFR-79 needs apart — one says retype it, the other go back to the register.
 *
 * `null` clears an identifier and is always permitted; `undefined` leaves it alone.
 */
function admitIdentifiers(identifiers: { readonly idno?: string | null; readonly lei?: string | null }): void {
  if (identifiers.idno !== undefined && identifiers.idno !== null && !validateIdno(identifiers.idno).shape) {
    throw new IdnoMalformedError();
  }
  if (identifiers.lei !== undefined && identifiers.lei !== null) {
    const verdict = validateLei(identifiers.lei);
    if (!verdict.shape) throw new LeiMalformedError();
    // `checkDigits` is `false` only when the shape passed, so the two refusals cannot overlap.
    if (verdict.checkDigits === false) throw new LeiCheckDigitsError();
  }
}

/**
 * FR-19's rule, over the boundary a write results in: a consolidated basis names a boundary, and one with nothing
 * inside it names nothing, while every figure in the report would be bounded by it. **One function for the create and
 * the edit** — the create path carried no copy until task 176, and admitted exactly the boundary this refuses.
 */
function admitBoundary(boundary: {
  readonly basis: ConsolidationBasis | null;
  readonly members: readonly unknown[];
}): void {
  if (boundary.basis === CONSOLIDATION_BASIS.CONSOLIDATED && boundary.members.length === 0) {
    throw new ConsolidationBoundaryEmptyError();
  }
}
