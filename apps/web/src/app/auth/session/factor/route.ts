import type { NextRequest } from 'next/server';
import { presentFactor } from '@/features/identity/reauthenticate/handlers/present-factor';

/**
 * `POST /auth/session/factor` — the re-authentication dialogue's second-factor code (task 92; UC-194,
 * UC-195).
 *
 * A Route Handler for the password stage's reason: it consumes, and on a refusal puts back, the sealed
 * challenge cookie, and a Server Action doing that would re-render the page beneath the dialogue. A shell —
 * the flow is `features/identity/reauthenticate/handlers/`.
 */
export function POST(request: NextRequest) {
  return presentFactor(request);
}
