import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { GlobalResponseInterceptor } from './app/interceptors/global-response.interceptor';
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
 * The four edge guards (AuthGuard, TenantTransactionGuard, EntitlementGuard,
 * AdminRealmGuard) are wired in the identity phase — they need session and membership
 * records to resolve against, and a guard that cannot do its job is worse than one that
 * is not yet installed.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    IdentityModule,
    CoreModule,
    BillingModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_INTERCEPTOR, useClass: GlobalResponseInterceptor }],
})
export class AppModule {}
