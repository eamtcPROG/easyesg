# Disclosure label catalogues

VSME element labels, help text and units, in **per-taxonomy-version directories**:

```
disclosure/<taxonomy-version>/{ro,en,ru}.json   the wording, one flat element-key → string map
disclosure/<taxonomy-version>/standing.json     which of those locales EFRAG itself publishes
```

**Both reasons this was empty are now closed** (task 33.2, 1 Sep 2026), and the second closed in a
way the note did not anticipate:

- **The version identifier** is EFRAG's own release date, `YYYY-MM-DD` — `architecture.md` OQ-45,
  closed by task 33.1. So the first directory is `2026-05-01/`.
- **There is content, but not the content this note expected.** It said *"NFR-24 requires EFRAG's
  published translation used verbatim for RO and EN … Russian has no EFRAG source and is
  platform-authored"*. Opening the published package showed **Romanian is a stub**: the taxonomy
  ships label linkbases for 23 languages, twelve carry labels, and `ro` holds zero. So **`en.json`
  alone is transcribed** — extracted by `tools/extract-vsme-labels.mjs` — and **both `ro.json` and
  `ru.json` are platform-authored** with no EFRAG standing. T-14, NFR-23, NFR-24, UX-47 and UX-98
  were amended together, and `problem_overview.md` OQ-5 closed on it.

  **`ro.json` is still the parity source** even though it is authored rather than official, because
  parity is about key coverage and Romanian is this product's source locale (NFR-23). Which file is
  *authoritative for a reader* is a different question, and UX-47 answers it: English.

## Why per-version and append-only

DR-4 pins every report to a template and taxonomy version. A report authored under one version
must still render *that version's* labels years later — after a newer template ships and after
a migration is offered. A single flat catalogue silently relabels historical reports, which is
the failure DR-4 exists to prevent. So a version directory is written once and never edited;
a new release is a new directory.

## Parity

`ro.json` is the source. Every key in it must exist in `en.json` and `ru.json` of the **same**
version directory — `src/disclosure-catalogues.parity.spec.ts` walks each directory independently,
because versions legitimately differ from one another. Cross-version drift is expected;
within-version drift is a defect.

## `standing.json` — provenance as data, per version and per locale

NFR-24 binds EFRAG's official translation wherever one is published, and UX-47 and UX-98 require a
reader to be **told** when the labels in front of them are not it — at export language selection and
on the exported document itself. That fact is data rather than a constant, for the reason DR-4 gives
everywhere else: standing belongs to `(version, locale)`. EFRAG ships the `ro` stub as a file it
evidently means to fill, and the release that fills it makes Romanian official **for that version and
no earlier one**, while a report pinned to `2026-05-01` must still state that its Romanian labels
were platform-authored.

`packages/i18n/src/locales.ts` used to answer this as `LOCALES_WITH_OFFICIAL_EFRAG_LABELS =
['ro', 'en']`, and it was deleted rather than corrected in task 33.2: the value was wrong, and the
*shape* could not have been right, since one list cannot answer for two registered versions.
`DisclosureLabelResolver.standing({ version, locale })` in `apps/api` replaces it, over this
manifest.

**`tools/extract-vsme-labels.mjs` is the manifest's only author**, and derives it from the same read
of EFRAG's linkbases that decides whether to refuse the run — so the standing shown to a reader
cannot disagree with what was extracted. Do not hand-edit it.

## Parity — paid by task 33.2

`src/catalogues.parity.spec.ts` guarded the shared catalogues beside this directory and did not walk
version directories, because there were none. `2026-05-01/` is the first, so
`src/disclosure-catalogues.parity.spec.ts` ships with it: parity **within** each version, never
across (versions differ from one another by design — that is DR-4). It walks with
`import.meta.glob`, typed locally — this package sets `"types": []` to stay isomorphic, which rules
out `node:fs` here as everywhere else in it.

**The glob and the reader's static imports are both needed, and neither is redundant.**
`apps/api`'s `modules/platform/localization/constants/disclosure-catalogues.ts` registers a version
by an explicit `import`, so the HTTP tier, the worker and jest all load it the same way; this spec
reads what is actually on disk. An import nobody added resolves nothing while every other test stays
green — a whole taxonomy's fields rendering unnamed — and a glob alone would register a directory by
the accident of its presence. The two sets are held equal in `apps/api`'s artefact spec, which can
also compare them against the taxonomy.

**One cross-artefact check lives elsewhere, deliberately.** Whether every element the *taxonomy*
registers has a label is asserted in
`apps/api/src/modules/platform/localization/disclosure-label.artefact.spec.ts`, because the taxonomy
is configuration under `config/seed/` and this package cannot see it. The two extractors are re-run
independently at every VSME release (NFR-12), and that spec is the only thing comparing their output.

## A note for whoever adds the second version

Adding `disclosure/<next-version>/` is four imports and one map entry in `apps/api`'s
`modules/platform/localization/constants/disclosure-catalogues.ts` and nothing else — the specs above
turn forgetting them into a failure. What is *not* optional is that the new
directory is written and the old one left alone: DR-4 is the whole reason these are per-version, and
an edit to `2026-05-01/` relabels every report already filed under it.
