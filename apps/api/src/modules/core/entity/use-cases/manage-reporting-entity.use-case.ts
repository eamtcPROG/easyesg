import type { Clock } from '@api/contracts/clock.port';
import type { OrganizationVocabulary } from '@api/modules/core/organization/interfaces/organization-vocabulary.interface';
import type { OrganizationStore } from '@api/modules/core/organization/interfaces/organization-store.interface';
import {
  CONSOLIDATION_BASIS,
  ENTITY_STATUS,
  type NewReportingEntity,
  type ReportingEntity,
  type ReportingEntityPatch,
} from '../models/reporting-entity.model';
import type { ReportingEntityStore } from '../interfaces/reporting-entity-store.interface';
import {
  ConsolidationBoundaryEmptyError,
  EntityArchivedError,
  EntityNotFoundError,
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
    await this.admitNaceCodes(command.entity.naceCodes);
    return this.store.create({ entity: command.entity, at: this.now() });
  }

  async update(command: UpdateEntityCommand): Promise<ReportingEntity> {
    const existing = await this.store.findEntity(command.entityId);
    if (!existing) throw new EntityNotFoundError();
    // FR-20: an archived entity's master data is frozen. Read still works — its reports have to
    // stay retrievable — so this is a refusal about state rather than about existence.
    if (existing.status === ENTITY_STATUS.ARCHIVED) throw new EntityArchivedError();

    if (command.patch.naceCodes !== undefined) await this.admitNaceCodes(command.patch.naceCodes);

    // FR-19, against the state the patch *results in* rather than the state it arrived at — the
    // same rule shape as the organization's legal form against its resulting country. Three
    // requests reach this refusal: setting the basis with no members stored, clearing the members
    // while the basis stands, and doing both at once.
    const basis =
      command.patch.consolidationBasis !== undefined
        ? command.patch.consolidationBasis
        : existing.consolidationBasis;
    const members =
      command.patch.consolidationMembers !== undefined
        ? command.patch.consolidationMembers
        : existing.consolidationMembers;
    if (basis === CONSOLIDATION_BASIS.CONSOLIDATED && members.length === 0) {
      throw new ConsolidationBoundaryEmptyError();
    }

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
