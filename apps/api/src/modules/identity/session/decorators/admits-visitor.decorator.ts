import { SetMetadata } from '@nestjs/common';
import { ADMITS_VISITOR } from '../constants/visitor-gate.constants';

/**
 * A route a visitor reaches with no session, and a member reaches with theirs (task 223; §12.5.6's task-223 row (6)) —
 * the cookie banner's answer, which must name the account when there is one and must not need one.
 *
 * **Not `@Public()`, and the difference is the bearer.** A public route never reads one, so it cannot say who called;
 * here `AuthGuard` admits a request that presents none as nobody's, and resolves one that does as for any route —
 * refusing a bearer it cannot resolve, so an ended session is sent to sign in rather than recorded as a visitor.
 *
 * **It admits an account in setup and one owing an acceptance**, which every other session-bearing route refuses: the
 * banner shows on S-36 and S-43 too, and answering it is neither setting up nor accepting anything.
 *
 * **It does not compose `@RequiresAccount`**, which `@AdmitsAccountInSetup` and `@AdmitsPendingLegalAcceptance` do:
 * requiring an account is exactly what a visitor's route must not do.
 */
export const AdmitsVisitor = () => SetMetadata(ADMITS_VISITOR, true);
