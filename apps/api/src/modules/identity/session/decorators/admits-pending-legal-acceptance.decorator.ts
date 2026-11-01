import { SetMetadata, applyDecorators } from '@nestjs/common';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { ADMITS_PENDING_LEGAL_ACCEPTANCE } from '../constants/legal-acceptance-gate.constants';

/**
 * A route an account owing an acceptance of the terms or the privacy notice may reach (task 195; §12.5.6's task-195
 * row (2), (3)) — S-43's read and its acceptance, and nothing else. `AuthGuard` refuses every other session-bearing
 * route to such an account with `legal-acceptance-required`; public routes, sign-out and refresh among them, never
 * reach that check, which is what leaves a member who declines able to sign out.
 *
 * **It composes `@RequiresAccount`**, for `@AdmitsAccountInSetup`'s reason: a route marked as admitting an owing account
 * must still need a session, and this makes the two unseparable.
 */
export const AdmitsPendingLegalAcceptance = () =>
  applyDecorators(SetMetadata(ADMITS_PENDING_LEGAL_ACCEPTANCE, true), RequiresAccount());
