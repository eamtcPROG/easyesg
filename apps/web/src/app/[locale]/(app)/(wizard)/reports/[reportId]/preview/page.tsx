/**
 * S-10 — Report preview · RC · UC-41 · Document
 *
 * UX-45: faithful — same content, same order, same marked gaps as the export. §4.11: the PDF is
 * produced by headless Chromium rendering the SAME React templates this preview uses, so FR-48
 * and FR-49 cannot drift. Where those shared templates live is an open question.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function ReportPreviewPage() {
  return null;
}
