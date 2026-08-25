import { Module, type Provider } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration, { APP_MODE } from './config/configuration';
import { AuthGuard } from '@api/modules/identity/session/guards/auth.guard';
import { TenantTransactionGuard } from './app/guards/tenant-transaction.guard';
import { GlobalResponseInterceptor } from './app/interceptors/global-response.interceptor';
import { TransactionInterceptor } from './app/interceptors/transaction.interceptor';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { ConfigurationStoreModule } from './infrastructure/configuration/configuration.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { OutboxModule } from './infrastructure/outbox/outbox.module';
import { HealthController } from './infrastructure/observability/health.controller';
import { CoreModule } from './modules/core/core.module';
import { IdentityModule } from './modules/identity/identity.module';
import { BillingModule } from './modules/billing/billing.module';
import { PlatformModule } from './modules/platform/platform.module';

/**
 * Composition root.
 *
 * Sits at src/ rather than inside app/ deliberately. app/ is cross-cutting code and carries
 * a dependency-cruiser rule that it may not import modules/**; the composition root imports
 * every namespace module by definition. It is wiring, not cross-cutting code, and putting it
 * here keeps the rule strict instead of carving an exemption into it.
 *
 * Two ordering rules that are easy to get wrong and expensive to debug:
 *
 *  - APP_INTERCEPTOR is registered outermost-first. AuditInterceptor must therefore be
 *    registered LAST, because last-registered is innermost and only the innermost
 *    interceptor sees the handler's raw return value — which is how it records a created
 *    row's id (FR-159).
 *  - ProblemDetailsFilter is registered in main.http.ts with useGlobalFilters and must be
 *    FIRST. Nest scans filters backwards from the last registered, so a catch-all added
 *    last swallows every specific filter.
 *
 * TenantTransactionGuard is registered here as of task 11, AuthGuard as of task 28.1.
 * EntitlementGuard and AdminRealmGuard still wait for their phases — a guard that cannot do its
 * job is worse than one that is not yet installed.
 *
 * **The request pipeline is registered in HTTP mode only, and that is one fact rather than four**
 * (26 Aug 2026, after CI). `main.worker.ts` builds an *application context* — no HTTP server, no
 * controllers, no requests — so a guard or an interceptor there governs nothing. Registering them
 * anyway was not merely redundant: `SessionModule` provides `AuthGuard` on the HTTP side only, so
 * `useExisting: AuthGuard` had nothing to resolve and **the worker refused to boot from task 28.1
 * onward**. Nothing local saw it — `openapi:check` runs in preview mode and instantiates no
 * provider, and every e2e boots HTTP — so the first CI run after that task was what found it, in
 * the Images job that starts the container the deploy would use.
 *
 * Guarding each provider individually would have been the smaller diff and the worse fix: the next
 * guard added below is one someone has to remember to guard too. One conditional over the list
 * states the thing that is actually true — the worker serves no requests — and cannot be forgotten
 * by an addition to it.
 */
const { mode } = configuration();

/**
 * §6.2's order, and it is the contract rather than a preference.
 *
 * `APP_GUARD` runs in registration order, and `AuthGuard` is what writes the organization into the
 * request context that `TenantTransactionGuard` binds `app.current_org` from. Registered the other
 * way round it would bind nothing, and every tenant read would return zero rows rather than fail —
 * the silent failure AD-2 and `TenantRepository` both exist to prevent.
 *
 * `useExisting` because `SessionModule` constructs `AuthGuard`: it needs the JWT secret and the
 * request-identity store, and a `useClass` here would ask Nest to build a second one from this
 * module's empty provider scope. That is also why this list is HTTP-only — see the header.
 * Task 28.2's `EntitlementGuard` and `AdminRealmGuard` join it in order.
 */
const requestPipeline: Provider[] = [
  { provide: APP_GUARD, useExisting: AuthGuard },
  { provide: APP_GUARD, useClass: TenantTransactionGuard },
  { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
  { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },
];
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PersistenceModule,
    ConfigurationStoreModule,
    QueueModule,
    OutboxModule,
    IdentityModule,
    CoreModule,
    BillingModule,
    PlatformModule,
  ],
  controllers: mode === APP_MODE.WORKER ? [] : [HealthController],
  providers: mode === APP_MODE.WORKER ? [] : requestPipeline,
})
export class AppModule {}
