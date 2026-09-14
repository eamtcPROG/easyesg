import type { Clock } from '@api/contracts/clock.port';
import { supportAccessRequestOf } from '../domain/support-access-request';
import {
  SupportAccessNotActiveError,
  SupportAccessRequestNotFoundError,
} from '../errors/support-access.errors';
import type { OrganizationSupportAccessStore } from '../interfaces/organization-support-access-store.interface';
import { SUPPORT_ACCESS_ENTRY_KIND } from '../models/support-access-log.model';
import { SUPPORT_ACCESS_STATE } from '../models/support-access-request.model';

export interface EndSupportAccessAsOrganizationCommand {
  readonly requestId: string;
  /** The Organization Administrator ending it — the bound member. */
  readonly actorId: string;
}

/**
 * An Organization Administrator ends running support access before its 60 minutes (task 67.9; UC-85 3a,
 * UX-124): **consent that can be given can be withdrawn** (project owner, 14 Sep 2026). Any Organization
 * Administrator of the organization, whoever granted it.
 */
export class EndSupportAccessAsOrganization {
  constructor(
    private readonly store: OrganizationSupportAccessStore,
    private readonly now: Clock,
  ) {}

  async execute(command: EndSupportAccessAsOrganizationCommand): Promise<void> {
    const history = await this.store.lock({ requestId: command.requestId });
    const record = history?.requests[0];
    if (history === null || record === undefined) throw new SupportAccessRequestNotFoundError();

    const at = this.now();
    const request = supportAccessRequestOf({ request: record, decisions: history.decisions, now: at });
    if (request.state !== SUPPORT_ACCESS_STATE.ACTIVE) throw new SupportAccessNotActiveError();

    await this.store.record({
      request: record,
      kind: SUPPORT_ACCESS_ENTRY_KIND.END,
      actorId: command.actorId,
      at,
    });
  }
}
