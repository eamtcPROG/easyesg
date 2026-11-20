# Taxonomy versions committed and not yet registered

A-04 registers a VSME taxonomy version **from here** (task 67.21; UC-75; `architecture.md` §12.5.6's task-67.21 row;
182/48): a version's artefacts are extracted offline — `tools/extract-vsme-taxonomy.mjs` and
`tools/extract-vsme-template-map.mjs`, which fail loudly on a shape they do not know — into `<version>/`, named as seed
files are (`vsme-taxonomy.<version>.json`, `vsme-waste-classification.<version>.json`,
`vsme-nace-classification.<version>.json`, `vsme-digital-template.<release>.json`, `vsme-digital-template-map.<release>.json`),
and the template binary itself under `config/efrag/<release>/`. They ship in a content release (NFR-86 as amended,
182/47) and nothing reads them until a Platform Administrator registers the version, which publishes them into the store
as one set — the taxonomy, its classifications, its templates and their maps, all or none.

**Registering is not adopting** (OQ-45, 182/52): no report pins a registered version until A-04's adoption schedule
says so, from a day. The two versions in force today, `2026-02-01` and `2026-05-01`, were seeded from `config/seed/`
before this directory existed and stay there.

The directory is empty while no candidate waits.
