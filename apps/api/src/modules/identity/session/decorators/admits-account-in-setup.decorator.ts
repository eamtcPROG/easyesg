import { SetMetadata, applyDecorators } from '@nestjs/common';
import { RequiresAccount } from '@api/modules/identity/membership/decorators/requires-account.decorator';
import { ADMITS_ACCOUNT_IN_SETUP } from '../constants/account-setup-gate.constants';

/**
 * A route an account still in setup may reach (task 155; §12.5.6's task-155 row) — its setup read
 * and its two writes, and nothing else. `AuthGuard` refuses every other session-bearing route to such
 * an account with `account-setup-required`; public routes, sign-out and refresh among them, never
 * reach that check.
 *
 * **It composes `@RequiresAccount`, rather than sitting beside it**, for that decorator's own reason:
 * metadata in one place and the gate in another has a failure mode with no symptom. A route marked
 * as admitting setup must still need a session, and this makes the two unseparable.
 */
export const AdmitsAccountInSetup = () =>
  applyDecorators(SetMetadata(ADMITS_ACCOUNT_IN_SETUP, true), RequiresAccount());
