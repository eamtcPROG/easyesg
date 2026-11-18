import { Injectable } from '@nestjs/common';
import { ConfigurationHistory } from '@api/infrastructure/configuration/configuration-history.service';
import { DISCLOSURE_APPLICABILITY_CONFIG_KIND } from '../constants/disclosure.constants';
import { readApplicabilityRules } from '../domain/applicability-rules-reader';
import type { ApplicabilityHistory } from '../interfaces/applicability-notice.interface';
import type { ApplicabilityRule } from '../models/applicability.model';

/**
 * `APPLICABILITY_HISTORY` over the store's version history (task 67.8): a revision's rules read as the wizard reads the
 * rules in force, through `readApplicabilityRules`. A revision superseded before task 67.8's publication rule could
 * carry a rule the reader drops; it is read without it, as the wizard read it while it was in force.
 */
@Injectable()
export class ApplicabilityHistoryService implements ApplicabilityHistory {
  constructor(private readonly history: ConfigurationHistory) {}

  async rulesAt(query: { readonly standard: string; readonly revision: number }): Promise<readonly ApplicabilityRule[] | null> {
    const version = await this.history.version({
      kind: DISCLOSURE_APPLICABILITY_CONFIG_KIND,
      scope: query.standard,
      revision: query.revision,
    });
    return version === undefined ? null : (readApplicabilityRules(version.payload)?.rules ?? null);
  }
}
