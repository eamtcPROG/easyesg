import {
  Inject,
  Injectable,
  Logger,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, concatMap } from 'rxjs';
import { SYSTEM_AUDIT_LOG, type SystemAuditLog } from '@api/contracts/system-audit-log.port';
import { requestContext } from '@api/infrastructure/persistence/request-context';
import {
  AUDIT_ACTION_METADATA,
  AUDIT_TARGET,
  type AuditDeclaration,
} from '../decorators/audit-action.decorator';

/**
 * §6.2's fourth obligation (task 67.4; FR-81, FR-159): **a successful state-changing admin-realm
 * request becomes one row in `audit.system_audit_log`**, under the action its route declares with
 * `@AuditAction`, attributed to the operator with the target and the time.
 *
 * **Registered last, so it is the innermost interceptor** (`app.module.ts`'s header): only the
 * innermost one sees the handler's raw return, which is where a created row's id is.
 *
 * **It writes after the handler returns and only then.** The admin realm's use cases commit their own
 * units of work inside the handler, so a returned value means the change is durable; an error never
 * reaches this operator, so a refused request writes nothing — the refusal is not a change. Awaited
 * rather than fired and forgotten, so the row exists by the time the response does, and a reader who
 * reloads A-08 sees what they just did.
 *
 * **Tenant mutations are not its business**: they carry no declaration, `core.field_change`'s trigger
 * attributes them per field, and a second copy here would record less than that one does.
 *
 * **A declared route with no operator in the context still writes, with no actor**, and says so at
 * `error`: that is a route that escaped `AdminRealmGuard`, which the permission table makes
 * impossible, and losing the event would hide the one thing worth knowing about it. The port never
 * rethrows, so nothing here can turn a success into a 500.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SYSTEM_AUDIT_LOG) private readonly audit: SystemAuditLog,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const declaration = this.reflector.get<AuditDeclaration | undefined>(
      AUDIT_ACTION_METADATA,
      context.getHandler(),
    );
    if (declaration === undefined) return next.handle();

    const { params } = context.switchToHttp().getRequest<Request>();

    return next.handle().pipe(
      concatMap(async (result: unknown) => {
        const actorId = requestContext()?.adminAccountId ?? null;
        if (actorId === null) {
          this.logger.error(
            `Recorded ${declaration.action} with no operator: the route declares an audit action and no admin session resolved`,
          );
        }

        await this.audit.record({
          action: declaration.action,
          actorId,
          targetId: targetOf({ declaration, params, result }),
        });
        return result;
      }),
    );
  }
}

const targetOf = (input: {
  readonly declaration: AuditDeclaration;
  readonly params: Request['params'];
  readonly result: unknown;
}): string | null => {
  const { target } = input.declaration;
  if (target.from === AUDIT_TARGET.PARAM) {
    const value = input.params[target.name];
    return typeof value === 'string' ? value : null;
  }

  const { result } = input;
  return typeof result === 'object' && result !== null && 'id' in result && typeof result.id === 'string'
    ? result.id
    : null;
};
