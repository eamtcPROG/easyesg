/**
 * A-21 — The platform operator · PA · FR-205 · Record (task 75)
 *
 * The controller the terms of service and the privacy notice name — the operator's registered name, IDNO, registered
 * address and data-protection contact — kept as store data a Platform Administrator edits with no release
 * (`architecture.md` §12.5.6's task-75 row (7)). The screen is `features/platform/admin/legal-controller/`; this
 * route holds no addressable state, the record being the whole screen.
 *
 * **The realm guard admits any operator; the api decides who reads.** A Billing Operator who follows a link here
 * sees §5.2's permission state, drawn from the api's 403.
 */
import { createFileRoute } from '@tanstack/react-router';
import { LegalController } from '~/features/platform/admin/legal-controller/components/section/legal-controller';

export const Route = createFileRoute('/_realm/legal-controller')({
  component: LegalController,
});
