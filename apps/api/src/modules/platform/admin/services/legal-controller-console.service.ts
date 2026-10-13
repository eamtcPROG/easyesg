import { Injectable } from '@nestjs/common';
import type { LegalControllerPublication, StoredLegalController } from '../models/legal-controller.model';
import {
  PublishLegalController,
  type PublishLegalControllerCommand,
} from '../use-cases/publish-legal-controller.use-case';
import { ReadLegalController } from '../use-cases/read-legal-controller.use-case';
import { requestOperatorId } from './request-operator';

/**
 * A-21's application seam (task 75; FR-205) — the operator's reading and its save. It resolves the one thing a route
 * cannot hand a use case: the acting operator, from the request (`request-operator.ts`), never the body.
 */
@Injectable()
export class LegalControllerConsoleService {
  constructor(
    private readonly readController: ReadLegalController,
    private readonly publishController: PublishLegalController,
  ) {}

  read(): Promise<StoredLegalController> {
    return this.readController.execute();
  }

  publish(input: Omit<PublishLegalControllerCommand, 'operatorId'>): Promise<LegalControllerPublication> {
    return this.publishController.execute({ ...input, operatorId: requestOperatorId() });
  }
}
