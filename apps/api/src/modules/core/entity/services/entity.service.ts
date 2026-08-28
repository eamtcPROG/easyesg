import { Inject, Injectable } from '@nestjs/common';
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
    @Inject(REPORTING_ENTITY_STORE) private readonly store: ReportingEntityStore,
  ) {}

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
