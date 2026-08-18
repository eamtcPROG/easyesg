/**
 * S-07 entry — resolves to the first incomplete module.
 *
 * UX-10: "Opening a report shall place the user at the first incomplete step, not at the
 * beginning." This segment exists to perform that resolution and redirect; it renders nothing.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function ReportEntryPage() {
  return null;
}
