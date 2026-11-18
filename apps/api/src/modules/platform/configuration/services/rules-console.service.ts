import { Injectable } from '@nestjs/common';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import type { RulesSlot } from '../models/rules-console.model';
import { PublishRules, type PublishRulesCommand } from '../use-cases/publish-rules.use-case';
import { ReadRulesConsole } from '../use-cases/read-rules-console.use-case';

/** A-05's application seam (task 67.8) — the operator resolved from the request, never the body. */
@Injectable()
export class RulesConsoleService {
  constructor(
    private readonly readConsole: ReadRulesConsole,
    private readonly publishRules: PublishRules,
  ) {}

  slots(): Promise<readonly RulesSlot[]> {
    return this.readConsole.execute();
  }

  publish(command: Omit<PublishRulesCommand, 'operatorId'>): Promise<{ readonly id: string; readonly revision: number }> {
    return this.publishRules.execute({ ...command, operatorId: requestOperatorId() });
  }
}
