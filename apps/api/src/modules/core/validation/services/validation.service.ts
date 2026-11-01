import { Injectable } from '@nestjs/common';
import { requestLocale } from '@api/infrastructure/persistence/request-context';
import type { NamedValidation, ValidationRules } from '../models/validation-run.model';
import { NameFindings } from '../use-cases/name-findings.use-case';
import { RunValidation } from '../use-cases/run-validation.use-case';

/**
 * The Nest-aware seam over UC-40 (task 41.2) — the request supplies the report and nothing else.
 *
 * **It resolves the reader's locale and names what the run or the read found** (task 42.2): the run is also the
 * worker's, which names nothing, so naming a finding's field is composed here, after it, for the HTTP answer alone.
 */
@Injectable()
export class ValidationService {
  constructor(
    private readonly validation: RunValidation,
    private readonly naming: NameFindings,
  ) {}

  async run(command: { readonly reportId: string }): Promise<NamedValidation> {
    return this.naming.name({ reading: await this.validation.run(command), locale: requestLocale() });
  }

  async read(query: { readonly reportId: string }): Promise<NamedValidation> {
    return this.naming.name({ reading: await this.validation.read(query), locale: requestLocale() });
  }

  rules(query: { readonly reportId: string }): Promise<ValidationRules> {
    return this.validation.rules(query);
  }
}
