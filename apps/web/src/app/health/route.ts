import { NextResponse } from 'next/server';

/**
 * Liveness for the blue/green switch (§10.6).
 *
 * NFR-53 requires zero-downtime, reversible deployment, which Compose cannot express:
 * `deploy.update_config` is Swarm-only and silently ignored by `docker compose up`. The
 * mechanism is therefore two Compose project instances behind `edge` — health-check the new
 * one, switch the Caddy upstream, retire the old. This route is what "health-check the new one"
 * calls, so it must answer before any tenant traffic arrives.
 *
 * Deliberately outside `[locale]` and excluded from the proxy matcher: it must answer
 * identically regardless of language, which means with no language at all. It also must not
 * require a session — a liveness probe that authenticates is testing the wrong thing.
 */
export function GET() {
  return NextResponse.json({ status: 'ok' });
}
