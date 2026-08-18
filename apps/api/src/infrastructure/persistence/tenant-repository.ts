import { EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';
import { DomainError } from '../../app/filters/domain.error';
import { ProblemType, ProblemTypeSlug } from '../../app/filters/problem-types';
import { requestContext } from './request-context';

export class TenantContextMissingError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.TenantContextMissing;
  readonly status = 500;

  constructor(entity: string) {
    super(
      `A tenant query on "${entity}" was attempted with no request context. ` +
        'Every tenant query must run on the request QueryRunner so RLS has a tenant bound.',
    );
  }
}

/**
 * Base for every repository over a tenant-owned table (AD-14, constraint 2).
 *
 * The throw is the point, and it is worth stating plainly: RLS returns zero rows when
 * `app.current_org` is unset, so a bare `repository.find()` on a pooled connection does
 * not fail — it succeeds and returns nothing. That presents to everyone downstream as
 * "this customer has no data" rather than as a bug, and it can survive review, staging
 * and a demo. Failing loudly here converts a silent data-loss illusion into a stack trace.
 *
 * Exceptions, each deliberate: `modules/identity/*` runs before a tenant exists;
 * `platform/audit` and `platform/metering` are append-only and cross-tenant by design;
 * and the admin API uses the separate read-only BYPASSRLS role, whose every acquisition
 * is logged (FR-79, NFR-66).
 */
export abstract class TenantRepository<T extends ObjectLiteral> {
  protected abstract readonly entity: EntityTarget<T>;

  /**
   * EntityTarget is a string, a constructor or an EntitySchema, so String() on it yields
   * "[object Object]" for two of the three — losing the only thing the error exists to
   * carry, which is which repository was called without a context.
   */
  private get entityName(): string {
    const target: unknown = this.entity;
    if (typeof target === 'string') return target;
    if (typeof target === 'function') return target.name;
    if (target && typeof target === 'object' && 'name' in target) {
      const { name } = target;
      if (typeof name === 'string') return name;
    }
    return 'unknown entity';
  }

  protected get manager(): EntityManager {
    const ctx = requestContext();
    if (!ctx?.queryRunner) {
      throw new TenantContextMissingError(this.entityName);
    }
    return ctx.queryRunner.manager;
  }

  protected get repository(): Repository<T> {
    return this.manager.getRepository(this.entity);
  }

  /** The organization RLS will scope to. Reads from the membership lookup, never a claim. */
  protected get organizationId(): string {
    const ctx = requestContext();
    if (!ctx?.organizationId) {
      throw new TenantContextMissingError(this.entityName);
    }
    return ctx.organizationId;
  }
}
