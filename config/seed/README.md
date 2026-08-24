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

## Arriving later

Taxonomy versions and mappings (task 33), factor sets (37), validation rules (40), notification
category behaviour (49), plans and entitlements (53), VAT rules (61). Each is a file here and rows
in `config.entry_version` / `config.entry_schedule` — no table, and no code, per artefact.
