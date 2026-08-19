# Disclosure label catalogues

VSME element labels, help text and units, in **per-taxonomy-version directories**:

```
disclosure/<taxonomy-version>/{ro,en,ru}.json
```

Empty today, deliberately. Two reasons, and neither is "nobody got to it":

- **The version identifier scheme is not defined anywhere.** `architecture.md` §10.7 names
  `config/efrag/` as "official Digital Template binaries, per version" without saying how a
  version is written, and `platform/taxonomy` is an empty module. Naming a directory here
  would decide that in passing. It belongs with the taxonomy work, which has the EFRAG
  releases in front of it. Raised as `architecture.md` OQ-45.
- **There is no content to put in one.** NFR-24 requires EFRAG's published translation used
  verbatim for RO and EN, so these files are transcribed from a template release, not
  authored. Russian has no EFRAG source and is platform-authored (T-14).

## Why per-version and append-only

DR-4 pins every report to a template and taxonomy version. A report authored under one version
must still render *that version's* labels years later — after a newer template ships and after
a migration is offered. A single flat catalogue silently relabels historical reports, which is
the failure DR-4 exists to prevent. So a version directory is written once and never edited;
a new release is a new directory.

## Parity

`ro.json` is the source. Every key in it must exist in `en.json` and `ru.json` of the **same**
version directory — `messages.parity.spec.ts` walks each directory independently, because
versions legitimately differ from one another. Cross-version drift is expected; within-version
drift is a defect.

## Owed when the first version lands

`src/catalogues.parity.spec.ts` guards the shared catalogues beside this directory but **does not
yet walk version directories** — there are none, and OQ-45 leaves how a version is written
undecided, so any glob written now would encode a naming scheme nobody has chosen.

Whoever adds the first version directory adds the check with it: parity **within** each version,
never across (versions differ from one another by design — that is DR-4). Note the constraint that
shapes the implementation: this package sets `"types": []` to stay isomorphic, so the check must
not reach for `node:fs`. Static imports, or `import.meta.glob` with its type declared locally.
