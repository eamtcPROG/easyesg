import { Inject, Injectable } from '@nestjs/common';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import type { ReportingEntity } from '../models/reporting-entity.model';
import {
  REPORTING_ENTITY_STORE,
  type ReportingEntityStore,
} from '../interfaces/reporting-entity-store.interface';
import { EntityNotFoundError } from '../errors/entity.errors';
import {
  ManageReportingEntity,
  type ArchiveEntityCommand,
  type CreateEntityCommand,
  type UpdateEntityCommand,
} from '../use-cases/manage-reporting-entity.use-case';
// **A value import, not `import type`.** Nest resolves a constructor dependency from
// `design:paramtypes`, which TypeScript emits from the *value* graph — an erased type-only import
// leaves `Function` in the metadata and the provider cannot be found. It fails at boot with
// "dependency at index 1", nowhere near the import that caused it. `NaceCodeMatch` stays a type
// import because it is one; the class has to be here.
import { SearchNaceCodes } from '../use-cases/search-nace-codes.use-case';
import type { NaceCodeMatch } from '../models/reporting-entity.model';

/**
 * The Nest-aware seam between `EntitiesController` and the use case (house rule: controllers call
 * services, services call use cases).
 *
 * The reads go straight to the store because there is no use case in them — RLS scopes the
 * statement, no rule applies, and a class wrapping one query would be the pass-through CLAUDE.md
 * warns about rather than the seam it requires. The writes carry UC-52, UC-53 and UC-55, which is
 * where `ManageReportingEntity` earns its place.
 */
@Injectable()
export class EntityService {
  constructor(
    private readonly manage: ManageReportingEntity,
    private readonly searchNaceCodes: SearchNaceCodes,
    @Inject(REPORTING_ENTITY_STORE) private readonly store: ReportingEntityStore,
  ) {}

  /**
   * S-13's activity picker (task 30.4.1).
   *
   * **The locale is resolved here and not taken from the wire**, which is `AccountService`'s rule
   * and the reason this method exists at all rather than the controller calling the use case: the
   * request's negotiated `Accept-Language` (OQ-46) is ambient context, and a locale a caller could
   * name would let one ask for another reader's language — harmless here, and the same shape as an
   * account id in a query string, which is exactly what this layer exists to prevent.
   */
  searchActivityCodes(input: { readonly query: string; readonly limit: number }): Promise<NaceCodeMatch[]> {
    return this.searchNaceCodes.execute({
      ...input,
      locale: requestContext()?.locale ?? SOURCE_LOCALE,
    });
  }

  list(): Promise<ReportingEntity[]> {
    return this.store.listEntities();
  }

  async view(entityId: string): Promise<ReportingEntity> {
    const entity = await this.store.findEntity(entityId);
    if (!entity) throw new EntityNotFoundError();
    return entity;
  }

  create(command: CreateEntityCommand): Promise<ReportingEntity> {
    return this.manage.create(command);
  }

  update(command: UpdateEntityCommand): Promise<ReportingEntity> {
    return this.manage.update(command);
  }

  archive(command: ArchiveEntityCommand): Promise<void> {
    return this.manage.archive(command);
  }
}
