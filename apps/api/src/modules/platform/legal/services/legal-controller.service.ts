import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { LEGAL_CONTROLLER_CONFIG_KIND, LEGAL_CONTROLLER_CONFIG_SCOPE } from '../constants/legal-controller.constants';
import { type LegalController, readLegalController } from '../domain/legal-controller';
import { LegalControllerUnavailableError } from '../errors/legal.errors';

/**
 * The controller in force, as the legal documents name it (task 75; FR-205). Read from the store's cache — a
 * public page reads it on every request, and an A-21 save is on every replica within the store's poll (AD-4).
 *
 * **Validated, never cast**, and **fails closed** — `SeatAllowanceService`'s shape: a missing or malformed
 * controller is refused rather than half-shown, because a document naming half an operator is what the task-75 row
 * (7) keeps from going live. Logged at `error` on every read, so an operator correcting it sees the line stop.
 */
@Injectable()
export class LegalControllerService {
  private readonly logger = new Logger(LegalControllerService.name);

  constructor(private readonly configurationStore: ConfigurationStore) {}

  inForce(): LegalController {
    const artefact = `${LEGAL_CONTROLLER_CONFIG_KIND}/${LEGAL_CONTROLLER_CONFIG_SCOPE}`;
    const entry = this.configurationStore.get({
      kind: LEGAL_CONTROLLER_CONFIG_KIND,
      scope: LEGAL_CONTROLLER_CONFIG_SCOPE,
    });

    if (!entry) {
      this.logger.error(`No ${artefact} is in force; the terms of service and the privacy notice are not served`);
      throw new LegalControllerUnavailableError();
    }

    const controller = readLegalController(entry.payload);
    if (controller === null) {
      this.logger.error(
        `Configuration entry ${artefact} (revision ${entry.revision}) is malformed; the terms of service and the privacy notice are not served until it is replaced`,
      );
      throw new LegalControllerUnavailableError();
    }
    return controller;
  }
}
