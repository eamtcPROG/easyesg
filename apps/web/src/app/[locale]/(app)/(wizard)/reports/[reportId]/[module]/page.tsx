/**
 * S-07 — Report wizard, module step · RC · UC-18…31, 37, 45, 46 · Wizard
 *
 * The whole product from RC's point of view. Hosts S-08 (validation panel) and S-12 (field change
 * history) as panels beside it, per their Panel archetype.
 *
 * UX-9: eleven Basic modules as a persistent, always-visible list, completable in any order —
 * except that B1 completes before any conditional module is presented, because applicability is
 * evaluated from it (≥50 employees → B8 turnover, ≥150 → B10 pay gap, sites → B5, sector → B6).
 * UX-26…28: conditional fields appear and disappear live, the change is announced non-modally
 * naming the causing B1 answer, and a value entered before disappearance is retained and restored.
 *
 * UX-13: read-only mode is a designed state with three causes — locked period (UC-57), view-only
 * membership, suspended entitlement (UC-142) — and the banner names which one applies.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function ReportModuleStepPage() {
  return null;
}
