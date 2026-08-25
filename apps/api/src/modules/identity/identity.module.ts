import { Module } from '@nestjs/common';
import { AccountModule } from './account/account.module';
import { SessionModule } from './session/session.module';
import { ProviderModule } from './provider/provider.module';
import { MembershipModule } from './membership/membership.module';
import { InvitationModule } from './invitation/invitation.module';

/**
 * Namespace barrel for `modules/identity/*` (architecture.md §5.2, §6.7).
 *
 * **It re-exports `SessionModule`, and that is not tidiness.** `AppModule` registers `AuthGuard` as
 * an `APP_GUARD` with `useExisting`, because `SessionModule` is what can construct it — the guard
 * needs the JWT secret and the request-identity store. `useExisting` resolves in the registering
 * module's scope, so without this the composition root cannot see the provider and the application
 * does not boot at all. That is the right failure: a guard the root cannot resolve must not
 * silently become no guard.
 */
@Module({
  imports: [
    AccountModule,
    SessionModule,
    ProviderModule,
    MembershipModule,
    InvitationModule,
  ],
  exports: [SessionModule],
})
export class IdentityModule {}
