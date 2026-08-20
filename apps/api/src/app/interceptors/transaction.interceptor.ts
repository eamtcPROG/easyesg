import { CallHandler, ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common';
import { Observable, concatMap } from 'rxjs';
import { commitTenantTransaction } from '../../infrastructure/persistence/tenant-transaction';

/**
 * Commits the request's tenant transaction on the success path.
 *
 * **The success path only, and the asymmetry is the design** (§6.2). Rollback lives in
 * `ProblemDetailsFilter`, because a guard that throws never reaches an interceptor — so an
 * `AuthGuard` or `EntitlementGuard` failure would leave a transaction open and a connection
 * borrowed forever if rollback were handled here.
 *
 * `concatMap` rather than `tap`: `tap` does not wait for a promise, so the response would be
 * written before the commit resolved and a commit failure would surface as an unhandled rejection
 * after the client had already been told the write succeeded. Here a failing commit propagates as
 * an error, reaches the filter, and the caller learns the truth.
 *
 * Registration order matters and is set in `app.module.ts`: `APP_INTERCEPTOR` runs
 * outermost-first, so this must be registered before `AuditInterceptor`, which has to stay
 * innermost to see the handler's raw return value.
 */
@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      concatMap(async (data: unknown) => {
        await commitTenantTransaction();
        return data;
      }),
    );
  }
}
