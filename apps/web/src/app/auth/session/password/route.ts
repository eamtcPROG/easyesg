import type { NextRequest } from 'next/server';
import { presentPassword } from '@/features/identity/reauthenticate/handlers/present-password';

/**
 * `POST /auth/session/password` — the re-authentication dialogue's password (task 92; UC-07).
 *
 * A Route Handler rather than a Server Action because a Server Action's cookie write re-renders the page
 * beneath the dialogue (`architecture.md` §12.5.6's task-92 row); outside `[locale]` and the proxy's
 * matcher for `/auth/social/…`'s reason. A shell — the flow is `features/identity/reauthenticate/handlers/`.
 */
export function POST(request: NextRequest) {
  return presentPassword(request);
}
