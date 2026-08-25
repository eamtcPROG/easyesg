import { ApiProperty } from '@nestjs/swagger';
import { MEMBERSHIP_ROLE } from '@api/modules/identity/membership/models/membership.model';
import { MEMBERSHIP_GRANT_KIND } from '../interfaces/invitation-bearer-store.interface';
import type { AcceptedInvitation } from '../use-cases/accept-invitation.use-case';

/**
 * What acceptance answers (UC-15, FR-11) — where the caller now is, and as what.
 *
 * **`role` is the role they hold, not the role the invitation named.** For someone who was already
 * a member the two differ, because §12.5.6's task-26.2 row leaves an existing member's role
 * untouched; publishing the invitation's would tell an administrator they are an editor on the
 * screen they land on to use that access. `MEMBERSHIP_ROLE` is therefore the enum here rather than
 * `INVITED_ROLE` — an existing member may hold `organization_administrator`, which FR-57 makes it
 * impossible for any invitation to assign.
 *
 * **`grant` is published rather than hidden** so a screen can say what actually happened: joined,
 * rejoined, or "you already had access". Three different sentences, and NFR-79 wants the true one.
 *
 * **No screen says them yet, and that is a recorded deferral rather than an oversight** (26 Aug 2026
 * review). S-03's exit is a redirect to S-05, which is task 30.5 and renders nothing today — so
 * there is nowhere to put the sentence, and inventing a fourth screen to hold it would be the
 * one-off UX-89 forbids. The obligation is on task 30.5's row: the home it builds states which of
 * the three happened. Until then acceptance is silent, and someone who already had access sees the
 * same landing as a new member.
 *
 * The active organization has already been changed server-side by the time this is read, so no
 * client action is needed and none is offered — the session is the only place tenancy lives (AD-2,
 * UX-2), and a client that had to remember to switch could forget.
 */
export class AcceptedInvitationResponseDto {
  @ApiProperty({ format: 'uuid', description: 'The organization just joined, now the active one.' })
  organizationId: string;

  @ApiProperty({ description: 'Its name, for the confirmation the screen shows.' })
  organizationName: string;

  @ApiProperty({
    enum: Object.values(MEMBERSHIP_ROLE),
    description:
      'The role the account now holds. For someone who was already a member this is their ' +
      'existing role — accepting an invitation never changes it.',
  })
  role: string;

  @ApiProperty({
    enum: Object.values(MEMBERSHIP_GRANT_KIND),
    description:
      'What the acceptance did: created a new membership, restored one that had been withdrawn, ' +
      'or found that access already stood.',
  })
  grant: string;

  constructor(accepted: AcceptedInvitation) {
    this.organizationId = accepted.organizationId;
    this.organizationName = accepted.organizationName;
    this.role = accepted.role;
    this.grant = accepted.grant;
  }
}
