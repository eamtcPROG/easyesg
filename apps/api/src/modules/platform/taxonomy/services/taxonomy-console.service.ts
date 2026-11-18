import { Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import type { VersionMapping } from '../domain/version-mapping';
import type { LabelDiff, TaxonomyConsole, TaxonomyExposure } from '../models/taxonomy-console.model';
import { AdoptTaxonomyVersion } from '../use-cases/adopt-taxonomy-version.use-case';
import { ProposeVersionMapping } from '../use-cases/propose-version-mapping.use-case';
import { PublishVersionMapping } from '../use-cases/publish-version-mapping.use-case';
import { ReadLabelDiff } from '../use-cases/read-label-diff.use-case';
import { ReadTaxonomyConsole } from '../use-cases/read-taxonomy-console.use-case';
import { ReadTaxonomyExposure } from '../use-cases/read-taxonomy-exposure.use-case';
import { RegisterTaxonomyVersion } from '../use-cases/register-taxonomy-version.use-case';

/**
 * A-04's application seam (tasks 67.21, 67.22, 67.6) — the operator resolved from the request, never the body. Exported
 * for the admin realm's controller, A-17's and A-03's arrangement.
 */
@Injectable()
export class TaxonomyConsoleService {
  constructor(
    private readonly readConsole: ReadTaxonomyConsole,
    private readonly registerVersion: RegisterTaxonomyVersion,
    private readonly proposeMapping: ProposeVersionMapping,
    private readonly publishMappingUseCase: PublishVersionMapping,
    private readonly adoptVersion: AdoptTaxonomyVersion,
    private readonly readExposure: ReadTaxonomyExposure,
    private readonly readLabelDiff: ReadLabelDiff,
  ) {}

  console(): Promise<TaxonomyConsole> {
    return this.readConsole.execute();
  }

  register(input: { readonly version: string }): Promise<{ readonly id: string }> {
    return this.registerVersion.execute({ ...input, operatorId: requestOperatorId() });
  }

  propose(pair: { readonly from: string; readonly to: string }): VersionMapping {
    return this.proposeMapping.execute(pair);
  }

  publishMapping(input: { readonly mapping: VersionMapping; readonly expectedRevision: number }): Promise<{
    readonly id: string;
    readonly revision: number;
  }> {
    return this.publishMappingUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }

  adopt(input: {
    readonly version: string;
    readonly templateVersion: string;
    readonly from: string;
    readonly expectedRevision: number;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    return this.adoptVersion.execute({ ...input, operatorId: requestOperatorId() });
  }

  exposure(): Promise<TaxonomyExposure> {
    return this.readExposure.execute({ requesterId: requestOperatorId() });
  }

  labelDiff(query: { readonly from: string; readonly to: string; readonly locale: Locale }): LabelDiff {
    return this.readLabelDiff.execute(query);
  }
}
