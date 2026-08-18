import { Module } from '@nestjs/common';
import { AccountModule } from './account/account.module';
import { SessionModule } from './session/session.module';
import { ProviderModule } from './provider/provider.module';
import { MembershipModule } from './membership/membership.module';
import { InvitationModule } from './invitation/invitation.module';

/** Namespace barrel for `modules/identity/*` (architecture.md §5.2, §6.7). */
@Module({
  imports: [
    AccountModule,
    SessionModule,
    ProviderModule,
    MembershipModule,
    InvitationModule,
  ],
})
export class IdentityModule {}
