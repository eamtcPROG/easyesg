# apps/renderer — working notes

Scoped to this workspace. The root `CLAUDE.md` still governs. `docs/architecture.md` §5, AD-10 and §12.5.6's task-44
row are authoritative for every decision below; this file carries what you need in hand while editing **here**.

## Current state

The renderer is live since task 44: one service, one route. `POST /render` takes `{ markup, generatedAt }` — a report
document's whole HTML, as `apps/api`'s `REPORT_DOCUMENT_RENDERER` writes it, and the moment it was produced in epoch
milliseconds — and answers the file as a tagged **PDF/A-2a and PDF/UA-1** document (NFR-82), or a status saying which
failure it was: 400 a body that is not a render request, 413 one too large, 504 a render killed at its deadline, 422 a
file the finisher refused to make conform, 500 anything else. `GET /health` answers `ok`. Its one client is the
worker's export job (`apps/api`, `core/export`); nothing in the request tier calls it (AD-10).

## The shape, and what each part guarantees

- **`src/print-pdf.ts` — Chromium, fresh for every render** (T-13). `chromium.launchServer()` per document, killed
  when it is done, so a render never inherits a wedged browser and a retry is on a fresh instance. Every request the
  page would make is aborted: the document carries its styles and fonts inside it and no script. It also reads each
  anchor's words in document order, for the finisher's link descriptions.
- **`finisher/finish_pdf.py` — the in-place step AD-10 gives qpdf and pikepdf.** Chromium 151's tagging is real —
  headings, lists, tables with `/Scope` and `/Headers`, `/Lang`, the title — and the finisher adds only what veraPDF
  found missing: the output intent (Debian's free sRGB profile) and the PDF/A and PDF/UA identification in XMP, an
  `LBody` in every list item, `/Contents` on every link, and Artifact marking for what is drawn but is not content —
  the inline marks' outlines, and the running header and footer as pagination. **It refuses rather than guesses**:
  untagged text inside the page body, or a link count that differs from the document's anchors, fails the render
  (exit 2 → 422). Never Ghostscript (AD-10).
- **`src/render-pdf.ts` — one deadline over both**, 60 s (§12.5.6's task-44 row (4)), at which the browser or the
  finisher is killed; a client that stops waiting kills its render too.
- **`src/render-slots.ts` — one render at a time** by default (`RENDER_SLOTS`), the rest queued in arrival order:
  Chromium's memory is the container's whole budget, and a render's deadline starts when it takes a slot.
- **`src/assert-chromium.ts` + `src/chromium-build.ts` — §12.5.9's control 2.** The Dockerfile runs it as the image's
  last step: the browser must launch, as the user the image runs as, and answer the pinned build, or the image is not
  built. Moving `CHROMIUM_BUILD` is the deliberate act control 3 asks for — re-run the export suite's veraPDF cases.

## Traps and load-bearing facts

- **The page margins are the finisher's furniture zone.** Untagged text whose origin lies within 20 mm of the top or
  bottom edge is marked as the header or footer; anywhere else it is refused. That is `document.css`'s
  `@page { margin: 20mm }` — move one and move the other, or the finisher refuses every page.
- **An empty table cell is a PDF/UA failure.** Chromium tags no `TD` for a cell with nothing painted in it, and a row a
  cell short fails PDF/UA-1 7.2. The api's templates never leave one empty (`module-row.tsx` prints a dash).
- **Run with an init process.** A killed render's orphans are reparented to PID 1, which Node never reaps — the dev
  and test stacks set `init: true`, and a deploy must too (`docker run --init`).
- **Debian's pikepdf is 6.0.0** (bookworm). `Name()` wants its leading slash (`Name("/Header")`), which newer pikepdf
  forgives. Its version is the base image's; §12.1 records what installed.
- **The hang is made from outside.** `apps/api/test/support/renderer-container.ts` stops the real Chromium with
  `SIGSTOP` through `docker exec`; nothing in this service knows a test is running.
- **To iterate on the finisher without rebuilding**, mount it over the image's copy:
  `docker run --rm -p 3199:3000 -v $PWD/finisher:/repo/apps/renderer/finisher:ro --init easyesg-renderer:dev`.

## Commands

| Need | Command |
| --- | --- |
| Unit tests (the pure parts: request, deadline, slots, config) | `pnpm --filter @easyesg/renderer test` |
| Typecheck | `pnpm --filter @easyesg/renderer typecheck` |
| The image | `docker build -f apps/renderer/Dockerfile -t easyesg-renderer:dev .` — or `pnpm test:up`, which builds it when absent |
| A render, end to end with veraPDF | `pnpm --filter @easyesg/api test:e2e test/pdf-export.e2e-spec.ts` |

## Before you call it done

Load `one-idea-per-file` and read it against the diff — this workspace has no `CLAUDE.md`-level folder rules beyond it.
A change to the finisher, to Chromium's pin, or to the document's templates is proven by the export suite's veraPDF
cases, run against a rebuilt image: a green unit run here says nothing about conformance.
