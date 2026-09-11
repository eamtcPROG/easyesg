/**
 * `features/public`
 *
 * Marketing, legal documents, help centre.
 *
 * **This folder is a leaf: it may import from `packages/ui` and nothing else in `src/features`.**
 * `web-public-is-a-leaf` enforces it.
 *
 * IMPLEMENTATION_PLAN Phase 10: "These can be pulled earlier if commercial timing demands it -
 * they share the token layer and the primitives and depend on nothing from phases 4-9. Nothing
 * later depends on them either." The rule is what keeps that sentence true.
 *
 * Not built. When it is, it holds the kinds its screens have — `components/ · tools/ · actions/`
 * (`one-kind-per-folder`); the scaffold folders went in task 134, and this barrel stays until then.
 */
export {};
