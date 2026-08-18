/**
 * S-11 — Export dialogue and history · RC · UC-42…44, UC-48 · Panel + Index
 *
 * UX-47: exactly two decisions and no more — format (PDF · EFRAG Excel) and language, chosen
 * independently of interface language (FR-52). Russian carries its caveat at the point of choice:
 * platform-authored labels, no EFRAG standing (UX-98).
 *
 * UX-46: an async job from the first interaction — immediate acknowledgement, a named place to
 * watch, freedom to leave the screen; past 30 s the result is delivered by notification (AD-10).
 * UX-25: export is permitted with unresolved findings after an explicit warning, with gaps
 * visibly marked rather than silently omitted (UC-42, FR-44). Reasoned omissions do not block
 * export — they flow into the document verbatim with their stated reason.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function ExportDialoguePage() {
  return null;
}
