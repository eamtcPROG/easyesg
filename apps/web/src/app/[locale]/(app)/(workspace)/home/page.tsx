/**
 * S-05 — Home / organization overview · all actors · UC-16, UC-67 · Workspace
 *
 * At `/{locale}/home`, not `/{locale}`. The marketing home holds the locale root because it
 * is the SEO landing page and the only page §14.2 permits to be cached. The two cannot share
 * an address — Next rejects two route groups resolving to one path, which is how this surfaced.
 *
 * The design set implies a host split instead (`easyesg.md` public, `app.easyesg.md` tenant),
 * but §3.2's surface table does not list a public surface at all and `app.easyesg.md` appears
 * exactly once, in a prototype. Rather than invent a host architecture, this takes the
 * reversible option: if the split is later confirmed, `/home` becomes `/` on the tenant host
 * behind a redirect. Logged as an open question.
 *
 * UX-6: answers three questions above the fold, in order — what needs my attention, where did I
 * leave off, what is the state of everything. A single-entity organization reduces to one
 * resumable report; the same template scales to multi-entity without a different screen.
 *
 * OQ-6 (closed): S-05 owns *view memberships*; the global-tier switcher owns *switch active
 * organization*. Counted once against both.
 *
 * Not built. `design_spec.md` §5 owns this screen's content, controls and states;
 * `design/IMPLEMENTATION_PLAN.md` owns when it lands. Prototypes in `design/screens/` are
 * the rendered reference — read them for values, never copy their markup (OQ-10).
 */
export default function HomePage() {
  return null;
}
