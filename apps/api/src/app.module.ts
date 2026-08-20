import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
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
 * TenantTransactionGuard is registered here as of task 11. The other three edge guards
 * (AuthGuard, EntitlementGuard, AdminRealmGuard) still wait for the identity phase — they
 * need session and membership records to resolve against, and a guard that cannot do its
 * job is worse than one that is not yet installed.
 *
 * TenantTransactionGuard does not need them: it opens a transaction when the request context
 * already carries an organization and does nothing when it does not, so it is correct both
 * before AuthGuard exists and after. APP_GUARD order follows registration order, which is why
 * AuthGuard must be added BEFORE this one — it is what puts the organization in the context
 * this reads.
 */
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
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: TenantTransactionGuard },
    { provide: APP_INTERCEPTOR, useClass: TransactionInterceptor },
    { provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor },
  ],
})
export class AppModule {}
