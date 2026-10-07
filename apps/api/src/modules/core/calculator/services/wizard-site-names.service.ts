import { Injectable } from '@nestjs/common';
import { B1_ELEMENT } from '@api/modules/core/disclosure/models/b1-element.model';
import { WizardService } from '@api/modules/core/disclosure/services/wizard.service';
import { siteNames } from '../domain/site-names';
import type { CalcSiteNames } from '../interfaces/calc-site-names.interface';

/**
 * `CALC_SITE_NAMES` over the wizard's own B1 step (task 39.1): the site rows named exactly as S-07 names them, because
 * S-09 groups its lines by those rows and a site must read the same on both screens.
 *
 * **B1 is the module whose step carries every site row's name**: the naming is axis-wide (task 36.6), so B1's fields
 * hold each site the report discloses, the record's sites included. The step is the request's own read — the same
 * transaction, tenant and locale — so nothing here binds or resolves anything.
 */
@Injectable()
export class WizardSiteNames implements CalcSiteNames {
  constructor(private readonly wizard: WizardService) {}

  async names(query: { readonly reportId: string }): Promise<ReadonlyMap<number, string>> {
    const step = await this.wizard.step({ reportId: query.reportId, module: B1_MODULE });
    return siteNames({ addressElement: B1_ELEMENT.SITE_ADDRESS, fields: step.fields });
  }
}

/** B1 — Basis for preparation, the module whose rows are the report's sites. */
const B1_MODULE = 'B1';
