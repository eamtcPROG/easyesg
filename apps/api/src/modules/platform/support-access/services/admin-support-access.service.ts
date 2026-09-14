import { Injectable } from '@nestjs/common';
import { DEFAULT_ON_PAGE } from '@api/app/constants/pagination.constants';
import type { RequestListDto } from '@api/app/dto/request-list.dto';
import { requestOperatorId } from '@api/modules/platform/admin/services/request-operator';
import type { SupportAccessLogPage } from '../models/support-access-request.model';
import {
  EndSupportAccessAsOperator,
  type EndSupportAccessAsOperatorCommand,
} from '../use-cases/end-support-access-as-operator.use-case';
import { ListSupportAccessLog } from '../use-cases/list-support-access-log.use-case';
import {
  RaiseSupportAccessRequest,
  type RaiseSupportAccessRequestCommand,
  type RaisedSupportAccessRequest,
} from '../use-cases/raise-support-access-request.use-case';

/** A page of A-07's log. */
export interface SupportAccessLogWindow {
  readonly take: number;
  readonly skip: number;
}

/**
 * A-07's platform half (task 67.9; UC-85, UC-86) — the log, a request, and ending a grant. The application seam
 * between the controllers and the use cases, and the place the acting operator is resolved from the request
 * rather than taken from the caller (`request-operator.ts`).
 */
@Injectable()
export class AdminSupportAccessService {
  constructor(
    private readonly raiseUseCase: RaiseSupportAccessRequest,
    private readonly endUseCase: EndSupportAccessAsOperator,
    private readonly listUseCase: ListSupportAccessLog,
  ) {}

  /** The compact list query, narrowed to a page: `onpage=-1` is refused upstream, so `take` is always a size. */
  window(list: RequestListDto): SupportAccessLogWindow {
    return { take: list.take ?? DEFAULT_ON_PAGE, skip: list.skip };
  }

  list(window: SupportAccessLogWindow): Promise<SupportAccessLogPage> {
    return this.listUseCase.execute({ ...window, requesterId: requestOperatorId() });
  }

  raise(input: Omit<RaiseSupportAccessRequestCommand, 'operatorId'>): Promise<RaisedSupportAccessRequest> {
    return this.raiseUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }

  end(input: Omit<EndSupportAccessAsOperatorCommand, 'operatorId'>): Promise<void> {
    return this.endUseCase.execute({ ...input, operatorId: requestOperatorId() });
  }
}
