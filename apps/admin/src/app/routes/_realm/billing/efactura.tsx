/**
 * A-13 — e-Factura transmission exceptions · BO · UC-130 · Exception queue
 *
 * Rejections and transmission failures from the national e-Factura service, surfaced with their reason for resolution (FR-127).
 *
 * FR-127 is explicit that the system "shall never mark an untransmitted invoice as delivered".
 * The mandate date is 1 October 2026. Provider error strings are not user-facing text — a rejection
 * reason must be translated into what happened, so what, and what now (NFR-79), never passed
 * through raw.
 *
 * Not built. `design_spec.md` §5.2 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in
 * `design/screens/EasyESG Admin Console Screens.dc.html` are the rendered reference — read them
 * for values, never copy their markup (design_spec.md OQ-10).
 */
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/_realm/billing/efactura')({
  component: EFacturaExceptionsRoute,
});

function EFacturaExceptionsRoute() {
  return null;
}
