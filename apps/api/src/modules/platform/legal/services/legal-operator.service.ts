import { Injectable } from '@nestjs/common';
import type { LegalOperator, OperatorIdentity } from '@api/contracts/legal-operator.port';
import { LegalControllerUnavailableError } from '../errors/legal.errors';
import { LegalControllerService } from './legal-controller.service';

/**
 * `LEGAL_OPERATOR` over the controller A-21 publishes (task 225): the same reading the legal pages make, through
 * `LegalControllerService`, so the footer and the privacy notice cannot name two operators. **The one difference is what
 * an absence answers** — the pages refuse, this answers `null` — and the service's own `error` line is what says the
 * artefact is missing, once per reading.
 */
@Injectable()
export class LegalOperatorService implements LegalOperator {
  constructor(private readonly controller: LegalControllerService) {}

  inForce(): OperatorIdentity | null {
    try {
      const { registeredName, registeredAddress } = this.controller.inForce();
      return { registeredName, registeredAddress };
    } catch (cause) {
      if (cause instanceof LegalControllerUnavailableError) return null;
      throw cause;
    }
  }
}
