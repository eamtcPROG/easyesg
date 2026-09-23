import { MemberPhoneNotFoundError } from '../errors/organization-register.errors';
import type { OrganizationMembersStore } from '../interfaces/organization-members-store.interface';

export interface DiscloseMemberPhoneCommand {
  readonly organizationId: string;
  readonly accountId: string;
  /** The operator reading — the acquisition log's requester (FR-79), from `AdminRealmGuard`. */
  readonly requesterId: string;
}

/**
 * One member's phone, for support to reach them about their account (task 167; FR-9; §12.5.6's task-167 row).
 *
 * **Each disclosure is one system audit log row** — the operator, whose phone, when — written by `AuditInterceptor`
 * from the route's `@AuditAction` once this answers, so A-08's log names every read of a person's number beside every
 * other operator action. A refusal writes nothing, since nothing was disclosed.
 */
export class DiscloseMemberPhone {
  constructor(private readonly store: OrganizationMembersStore) {}

  async execute(command: DiscloseMemberPhoneCommand): Promise<{ readonly phone: string }> {
    const phone = await this.store.phone(command);
    if (phone === null) throw new MemberPhoneNotFoundError();
    return { phone };
  }
}
