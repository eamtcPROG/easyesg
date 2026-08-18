import { Module } from '@nestjs/common';
import { CatalogueModule } from './catalogue/catalogue.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { AccountModule } from './account/account.module';
import { OrderModule } from './order/order.module';
import { PaymentModule } from './payment/payment.module';
import { InvoicingModule } from './invoicing/invoicing.module';
import { EfacturaModule } from './efactura/efactura.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { CollectionsModule } from './collections/collections.module';
import { RefundsModule } from './refunds/refunds.module';
import { EnterpriseModule } from './enterprise/enterprise.module';
import { FinreportingModule } from './finreporting/finreporting.module';

/** Namespace barrel for `modules/billing/*` (architecture.md §5.2, §6.7). */
@Module({
  imports: [
    CatalogueModule,
    SubscriptionModule,
    EntitlementModule,
    AccountModule,
    OrderModule,
    PaymentModule,
    InvoicingModule,
    EfacturaModule,
    ReconciliationModule,
    CollectionsModule,
    RefundsModule,
    EnterpriseModule,
    FinreportingModule,
  ],
})
export class BillingModule {}
