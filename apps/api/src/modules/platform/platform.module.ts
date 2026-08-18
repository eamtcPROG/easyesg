import { Module } from '@nestjs/common';
import { ConfigurationModule } from './configuration/configuration.module';
import { TaxonomyModule } from './taxonomy/taxonomy.module';
import { LocalizationModule } from './localization/localization.module';
import { NotificationModule } from './notification/notification.module';
import { MeteringModule } from './metering/metering.module';
import { AuditModule } from './audit/audit.module';
import { SupportAccessModule } from './support-access/support-access.module';
import { AdminModule } from './admin/admin.module';

/** Namespace barrel for `modules/platform/*` (architecture.md §5.2, §6.7). */
@Module({
  imports: [
    ConfigurationModule,
    TaxonomyModule,
    LocalizationModule,
    NotificationModule,
    MeteringModule,
    AuditModule,
    SupportAccessModule,
    AdminModule,
  ],
})
export class PlatformModule {}
