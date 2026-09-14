import { Injectable } from '@nestjs/common';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import type { RequestListDto } from '@api/app/dto/request-list.dto';
import { toSystemAuditLogQuery } from '../domain/system-audit-log-query';
import type { SystemAuditLogPage, SystemAuditLogQuery } from '../models/system-audit-log.model';
import { ListSystemAuditLog } from '../use-cases/list-system-audit-log.use-case';
import { requestOperatorId } from './request-operator';

/**
 * A-08's log (task 67.4; UC-88). It narrows what arrived — `OrganizationRegisterService`'s split, for
 * its reason: the controller needs the page size to count pages, so the narrowing answers first — and
 * names the requester the `esg_admin_ro` acquisition is logged against.
 */
@Injectable()
export class SystemAuditLogService {
  constructor(private readonly listUseCase: ListSystemAuditLog) {}

  narrow(input: {
    readonly list: RequestListDto;
    readonly operator: unknown;
    readonly action: unknown;
    readonly from: unknown;
    readonly to: unknown;
  }): SystemAuditLogQuery {
    return toSystemAuditLogQuery({ ...input, fallbackTake: DEFAULT_ON_PAGE });
  }

  list(query: SystemAuditLogQuery): Promise<SystemAuditLogPage> {
    return this.listUseCase.execute({ requesterId: requestOperatorId(), query });
  }
}
