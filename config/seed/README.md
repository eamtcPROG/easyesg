# config/seed

The starting state of the configuration store (DR-3, AD-4), applied by
`pnpm --filter @easyesg/api config:seed`.

Each file is one artefact: `<kind>.<scope>.json`, holding the payload. The loader publishes a file
as a new revision **only when its payload differs from what is currently in force**, so running it
twice changes nothing and running it after an edit publishes exactly one revision.

That idempotence is the point. A seed that republished on every run would make the store version
move on every deploy, invalidating every replica's cache for no change — and it would bury the real
publication history under identical revisions, which is what NFR-19 needs preserved so a stored
calculation can be reproduced against the factor set it actually used.

## What belongs here, and what does not

Seeds are the values the platform ships with. Everything an operator edits afterwards lives only in
the store, and a later seed run must not undo it — which is why the loader compares payloads rather
than asserting them.

**Wording does not belong here.** OQ-43 (closed 19 Aug 2026) narrowed AD-4 to behaviour rather than
text: labels, help text, validation messages and notification templates ship as committed message
catalogues in `packages/i18n`. Only help-centre articles and plan presentation copy — the text
edited by people who cannot deploy — stay in the store.

## Present

| File | Kind | Why it is here and not in code |
| --- | --- | --- |
| `locale-registration.global.json` | `locale_registration` | AD-4 lists locale registration as store data (FR-63, NFR-25): *which* locales are offered is configuration, while the catalogues themselves are committed. Registering a fourth is A-03's screen, not a release |
| `identity-provider.google.json` | `identity_provider` | FR-82: a social provider's behaviour — enabled state, client id, issuer, scopes, redirect allowlist — is store data so it can be withdrawn or rotated without a redeploy (A-18's screen, task 67). Ships **disabled with an empty client id**: enabling is a deployment's decision, made by publishing real values. The client secret is deliberately NOT here — it is an environment variable until OpenBao exists (§12.5.6's task-24 configuration row) |
| `identity-provider.microsoft.json` | `identity_provider` | As above. The issuer is the Entra multi-tenant `common` endpoint; its `{tenantid}` issuer template is resolved per token by the OIDC client |
| `organization-legal-form.md.json` | `organization_legal_form` | FR-15's legal form, **scoped by country** (§7.2, 28 Aug 2026). No document in the set enumerates the values, and one global list would admit a Romanian *SRL* because Moldova spells it the same way while refusing a Romanian *PFA* with a message about Moldova. The `md` list is Law 220/2007's and the Civil Code's register. Codes only — the labels are catalogue keys shipped with the release (OQ-43), so a form registered ahead of its label renders its key **Since task 91.2 the payload also carries `vsmeMembers`** — form → the member of EFRAG's `ListOfUndertakingsLegalFormsMember` it discloses as (`srl` → `PrivateLimitedLiabilityUndertakingMember`; `sa`, `is`, `im` → *other*, there being no public-limited or state-enterprise member; `gt` → sole proprietorship), the project owner's classification of 2 Sep 2026. A form absent from the map pre-fills nothing; `entity-defaults.spec.ts` holds every registered form classified into a member both shipped taxonomy versions declare. |
| `nace-code.md.json` | `nace_code` | FR-17's activity classification, **scoped by country** because the classifier is national. Moldova's is CAEM Rev.2, published by the National Bureau of Statistics and harmonised 1:1 with NACE Rev.2 to four characters, so a code stored here is the NACE code B1 exports. 996 entries — 21 sections, 88 divisions, 272 groups, 615 classes, each count matching NACE Rev.2 exactly. **Unlike every other seed, this one carries names**, and §7.2 records why: they are an external authority's own published text, like the EFRAG taxonomy labels NFR-24 points at, not wording this project authored |
| `organization-relationship-type.global.json` | `organization_relationship_type` | FR-14 and NFR-9: Advisor, Buyer and Licensee must be addable **with zero schema migrations**, which is why `core.org_relationship.organization_type` carries no membership CHECK. `direct_sme` is the only type active at MVP, and NFR-9's verification is registering a fourth here in staging |
| `vsme-taxonomy.2026-02-01.json` | `vsme_taxonomy` | **The second registered version (task 33.3, R-7).** EFRAG's February 2026 release, extracted by the same script. It is here so the version dimension is exercised by every run rather than discovered at the first rollout — the risk register's own mitigation. Its shape differs from May's in a way worth knowing: EFRAG renamed the presentation roles, and its catch-all disclosures sit in one `[D99.000]` role where May splits them three ways by pillar |
| `vsme-waste-classification.2026-02-01.json` | `vsme_waste_classification` | The EU List of Waste as February 2026 published it. Byte-identical to the May artefact apart from its `version` field — which is the point of extracting per version rather than assuming: that they agree is a fact about this pair of releases, not a rule |
| `vsme-taxonomy.2026-05-01.json` | `vsme_taxonomy` | FR-65 and AD-3: one registered taxonomy version — 143 reportable elements across B1–B11 and C1–C9, with their kinds, period types, presentation order and dimensions. **Scope is the version**, EFRAG's own release identifier (OQ-45, closed 29 Aug 2026), so every registered version stays readable by name forever and two coexist as DR-4 requires. Generated by `tools/extract-vsme-taxonomy.mjs` from the published package, never hand-edited. **No labels** — a disclosure label is product UI text and ships in `packages/i18n` (OQ-43) |
| `vsme-waste-classification.2026-05-01.json` | `vsme_waste_classification` | The EU List of Waste — 973 members — which B7's `TypeOfWasteAxis` draws its domain from. **Its own artefact rather than inlined**, because EFRAG publishes and versions it as a separate taxonomy and DR-4 makes version a data dimension: folded in, a waste-list revision would be indistinguishable from a VSME release. **Carries names**, for the NACE row's reason above — an external authority's published text (NFR-24), not wording this project authored. **English only, which is all EFRAG publishes**; `ro` and `ru` are platform-authored and outstanding (T-14) |
| `vsme-nace-classification.2026-05-01.json` | `vsme_nace_classification` | **The NACE classification EFRAG ships beside VSME** — 1 047 members, sections to classes — which B1's `NaceSectorClassificationCodes` draws its domain from (task 91.1). Its own artefact on the waste list's reasoning: EFRAG versions it separately, and folded in, a NACE revision would be indistinguishable from a VSME release. **Carries the pointed code** (`01.11`) rather than the member's `NACE_A0111` spelling, because the code is what CAEM prints and what `nace-code.md.json` is keyed by — so the platform's own Romanian and Russian names resolve by code, and only English is EFRAG's. A `2026-02-01` copy exists for the same reason the waste list's does |
| `reporting-taxonomy.vsme.json` | `reporting_taxonomy` | Which version a period or report is pinned to (FR-66). **Two windows since task 33.3** — a period starting before 2026-01-01 pins `2026-02-01`, one starting on or after it pins `2026-05-01` — so a FY2025 report and a FY2026 report carry different pins through the product's own path. See *Scheduled seeds* below. **Deliberately not derived from the newest registered version**: the date EFRAG publishes a release and the date this platform adopts it are different facts, so adoption is effective-dated data an operator schedules, not a `max()` in code. Scope is the standard |

## Regenerating the taxonomy artefacts

The `vsme-*` files are **extracted, not authored** — the taxonomy, and the two external classifications (waste, NACE) it draws domains from:

```
node tools/extract-vsme-taxonomy.mjs <unpacked-package-dir> <version>
```

Editing them by hand is the mistake to avoid — the next release regenerates the file and silently
discards the edit. A correction belongs in the extractor, where it survives.

The packages these were extracted from, so a regeneration can be checked against the same bytes:

| Version | Package | SHA-256 |
| --- | --- | --- |
| `2026-05-01` | [`VSME-XBRL-Taxonomy-May-2026.zip`](https://xbrl.efrag.org/downloads/vsme/VSME-XBRL-Taxonomy-May-2026.zip) | `47e1c4a6df7b20ae4849ac6e4cc9d05bf6fcce7ca3f2e9ac7096cf591afbfbff` (508 353 B, recorded 2 Sep 2026 on task 91.1's regeneration) |
| `2026-02-01` | [`VSME-XBRL-Taxonomy-February-2026.zip`](https://xbrl.efrag.org/downloads/vsme/VSME-XBRL-Taxonomy-February-2026.zip) | `c65f2e174400f0d1a63d3dabdb2a8fa1b3a8f74ac8eaa56e32bc0ba87aa7b8d0` (484 889 B) |

The script asserts rather than defaults: an unmapped XBRL item type, a concrete element that reaches
no presentation role, an explicit axis that resolves no members, **or a reportable element that
resolves no module and sits in no catch-all role** each fail the run and name what they found. Each
of those four assertions exists because it caught a real defect on first use — `architecture.md` §7.3
records what the third one found, and the fourth is task 33.3's.

**The fourth is worth reading before adding a fifth.** This file's header had claimed since task 33.1
that the run "fails loudly if the element count, the concrete count or the module coverage moves".
The first two were asserted and the third was not, which stayed invisible because a role-naming
scheme the script cannot read yields `module: null` for *every* element — and the summary then prints
them as the pillar catch-alls. Extracting February 2026 produced 143 of 143 unmoduled and exited 0. A
claimed assertion that does not exist is the shape this repository keeps finding; the lesson is that
the summary line was the accomplice, reporting a total failure as a known benign category.

## Scheduled seeds

A file normally holds one payload. It may instead hold a **schedule** — the effective-dated windows
that payload occupies:

```json
{ "schedule": [
  { "validTo":   "2026-01-01", "payload": { "version": "2026-02-01" } },
  { "validFrom": "2026-01-01", "payload": { "version": "2026-05-01" } }
] }
```

Both bounds are optional calendar dates (NFR-34) and map to the store's own `daterange`. The form is
generic rather than taxonomy-specific: AD-4 lists effective dates as store data, so factor sets, VAT
rules and thresholds will each want it.

**A file is a schedule only when `schedule` is its one and only key.** A payload that happened to
carry a `schedule` field would otherwise be read as one and lose the rest of itself silently.

**Idempotence is per window.** Each is compared against what is in force *inside* it — at its start,
or the day before its end where it has no start — rather than against what is in force today, which
would republish a historical window on every run.

**The loader will not narrow a schedule that is already in force.** `config.entry_schedule` is keyed
`WITHOUT OVERLAPS`, so replacing one unbounded slot with two windows collides; rather than let
Postgres report `entry_schedule_pkey` from four directories away, or silently delete a slot an
operator may have scheduled, the run stops and names the ranges it found. Reshaping an adopted
schedule is an operator action with a revert path (NFR-85). A fresh database never sees this.

## Arriving later

Taxonomy mappings (tasks 67.6, 67.7), factor sets (37), validation rules (40), notification
category behaviour (49), plans and entitlements (53), VAT rules (61). Each is a file here and rows
in `config.entry_version` / `config.entry_schedule` — no table, and no code, per artefact.
