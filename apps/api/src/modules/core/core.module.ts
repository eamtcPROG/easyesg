import { Module } from '@nestjs/common';
import { OrganizationModule } from './organization/organization.module';
import { EntityModule } from './entity/entity.module';
import { PeriodModule } from './period/period.module';
import { DisclosureModule } from './disclosure/disclosure.module';
import { CalculatorModule } from './calculator/calculator.module';
import { ValidationModule } from './validation/validation.module';
import { ComparativesModule } from './comparatives/comparatives.module';
import { ExportModule } from './export/export.module';
import { TraceModule } from './trace/trace.module';

/** Namespace barrel for `modules/core/*` (architecture.md §5.2, §6.7). */
@Module({
  imports: [
    OrganizationModule,
    EntityModule,
    PeriodModule,
    DisclosureModule,
    CalculatorModule,
    ValidationModule,
    ComparativesModule,
    ExportModule,
    TraceModule,
  ],
})
export class CoreModule {}
