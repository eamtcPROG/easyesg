# `src/shared/` — cross-context primitives

**Provisional on purpose — and no longer empty.** Since task 67.3 it holds `index-view.tsx`, the
Index archetype with the console's chrome labels bound once: A-02 is its first reader, and the
billing exception queues (A-10 … A-14) are Index screens too, so it is what **both** contexts need —
this folder's admission test, met. What follows is the reason the folder was created, and it still
holds for the generic editor it describes.

Five screens are the user interface for config-as-data — `A-03`, `A-04`, `A-05`, `A-09` and
`A-17` — and `design/IMPLEMENTATION_PLAN.md` Phase 11 is explicit about how they must be built:

> Build them as generic editors over versioned config, not as bespoke forms per artefact — adding
> a taxonomy element or a factor set must need no code change.

That generic editor, and the UX-123 blast-radius flow it sits inside (preview → scope disclosure →
confirm → progress → result → one-step revert), is needed by **both** bounded contexts: `A-03`,
`A-04`, `A-05` and `A-17` are platform, `A-09` is billing. It therefore cannot live in
`features/platform/configuration/` — `admin-billing-not-to-platform` would reject the import, and
correctly so, because DR-1 and D-11 keep the two contexts apart.

`packages/ui` is the natural home, and `architecture.md` **OQ-38** — where shared React templates
live — is open. This folder is the placeholder that keeps the question visible instead of letting
it get answered by whoever writes `A-09` first. When OQ-38 closes toward `packages/ui`, the
contents move there and this folder goes away.

Nothing here may import from `features/`.
