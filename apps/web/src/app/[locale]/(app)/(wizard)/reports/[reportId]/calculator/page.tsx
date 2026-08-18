/**
 * S-09 — Carbon calculator · RC · UC-32…34 · Wizard sub-flow (composes Wizard)
 *
 * UX-40: consumption is entered in the units of the user's own invoices. B3 asks for tonnes of
 * CO2e and nobody has a bill in tonnes. UX-42: derivation shown in one step — input → conversion
 * → factor applied → result, naming the factor-set version. UX-43: an override requires a reason,
 * shows the superseded value beside the substituted one, and carries an attribution marker into
 * preview and export. UX-44: a newer factor set produces a non-blocking notice that OFFERS
 * re-derivation — never forces it.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function CarbonCalculatorPage() {
  return null;
}
