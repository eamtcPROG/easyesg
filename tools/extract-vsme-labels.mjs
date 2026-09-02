/**
 * Turns EFRAG's published VSME XBRL taxonomy package into the **English** half of the label
 * catalogue (task 33.2).
 *
 *     node tools/extract-vsme-labels.mjs <unpacked-package-dir> <version>
 *
 * A sibling of `extract-vsme-taxonomy.mjs`, and the division between them is OQ-43's: that script
 * takes the taxonomy's *shape* into `config/seed/` because shape is behaviour and must move without
 * a redeploy; this one takes its *wording* into `packages/i18n`, because wording ships with the
 * release. Its own header says so and names this task as the owner of the other half.
 *
 * ## Only English is extracted, and that is a finding rather than a limitation
 *
 * NFR-24 binds the official EFRAG translation **wherever one is published**. At `2026-05-01` that is
 * English alone of this product's three locales: the package ships label linkbases for 23 languages
 * and **twelve carry labels**, while eleven — `ro` among them — are 1,161-byte stubs holding zero.
 * Romanian and Russian are therefore both platform-authored (T-14, NFR-23 and UX-47 as amended
 * 31 Aug 2026; `problem_overview.md` OQ-5 closed in the same change).
 *
 * **So this script's most important job is to notice when that stops being true.** EFRAG ships the
 * `ro` stub as a file it evidently means to fill, and the failure mode is silent: a release that
 * populated it would leave the platform serving an authored Romanian label over an official one,
 * against NFR-24, with every gate green. `standingOfLocales` is what refuses to let that pass — it
 * fails the run when a language this project authors starts carrying labels, and when one that
 * carried them stops. Past those two refusals it emits what it read as `standing.json` beside the
 * catalogues, so the provenance UX-47 and UX-98 make a reader see is derived from EFRAG's own files
 * rather than maintained by hand as a claim about them.
 *
 * ## Extraction, and why the arcs are not optional
 *
 * A label linkbase is three parts: a `link:loc` naming the element, a `link:label` holding the text,
 * and a `link:labelArc` joining them. It is tempting to skip the arc and match the locator's
 * `xlink:label` to the element name, because they are usually equal — and EFRAG's own data is why
 * that fails: `VolumeOfMaterialUsed` is located under the label `VolumneOfMaterialUsed`, misspelled
 * at source. Following the arc is correct; assuming the names match silently mislabels whatever the
 * typo touches.
 *
 * Roles matter too. The package carries `label` (the standard label, what a form shows),
 * `documentation` (help text — UX-17's, taken since task 91.1 into `help/`), `measurementGuidance`
 * (the units an element admits — `[utr:kg,utr:t]` — which is unit data rather than wording and is
 * left for the task that offers units, UX-14), `verboseLabel` and `totalLabel`.
 *
 * ## Three catalogues per version, since task 91.1
 *
 *     <version>/{ro,en,ru}.json          the element labels — the standard's question
 *     <version>/help/{ro,en,ru}.json     EFRAG's `documentation` label, where one is published
 *     <version>/members/{ro,en,ru}.json  the enumeration members' labels — the answers a choice
 *                                        field offers, read from the artefact's `enumerations`
 *
 * Help is **sparse by construction**: at `2026-05-01` EFRAG documents 22 of 143 elements, and the
 * catalogue carries those 22 and no invented sentence for the rest — a field with no help says so
 * rather than paraphrasing its own label (OQ-59, closed 2 Sep 2026). Members are total: every member
 * of every `vsme` enumeration domain must label, and the run fails otherwise, for the reason the
 * element check below gives — an unlabelled member is an XBRL name rendered as an answer.
 *
 * Only English is written here, for all three; `ro` and `ru` are platform-authored beside them.
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , packageDir, version] = process.argv;
if (!packageDir || !version) {
  console.error('usage: node tools/extract-vsme-labels.mjs <unpacked-package-dir> <version>');
  process.exit(1);
}

/** The locales this product serves. Anything else in the package is not our business. */
const LIVE_LOCALES = ['ro', 'en', 'ru'];

/** What we expect to be officially published at the pinned version, having opened it. */
const EXPECTED_OFFICIAL = ['en'];

/**
 * Mirrors `LABEL_STANDING` in `packages/i18n/src/disclosure-standing.ts`, which is the declaration —
 * a build tool cannot import the workspace package it writes into without making the catalogue's
 * own build a prerequisite of regenerating it. Two committed checks assert the manifest only ever
 * holds members of the real vocabulary — `packages/i18n/src/disclosure-catalogues.parity.spec.ts`
 * and `readStanding` in `apps/api/.../constants/disclosure-catalogues.ts`, which throws at load — so
 * a drift here fails there rather than shipping.
 */
const LABEL_STANDING = { OFFICIAL: 'official', PLATFORM_AUTHORED: 'platform_authored' };

const findFiles = (dir) => {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const path = join(d, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.xml')) out.push(path);
    }
  };
  walk(dir);
  return out;
};

const labelledLanguages = (files) => {
  const carrying = new Set();
  for (const file of files) {
    const xml = readFileSync(file, 'utf8');
    for (const match of xml.matchAll(/<link:label\b[^>]*xml:lang="([^"]+)"/g)) {
      carrying.add(match[1]);
    }
  }
  return carrying;
};

/**
 * **The gate this script exists for as much as for the extraction**, and the manifest's only author.
 *
 * Fails when a locale this project authors starts carrying official labels — which would silently
 * put an authored label in front of an official one, against NFR-24 — and when one that carried
 * them stops, which would leave the catalogue asserting a standing the package no longer supports.
 * Either way the answer is a decision, not a re-run: T-14, NFR-23, NFR-24, UX-47 and UX-98 all name
 * which locales are platform-authored, and they must be amended together.
 */
const standingOfLocales = (carrying) => {
  const nowOfficial = LIVE_LOCALES.filter((l) => carrying.has(l) && !EXPECTED_OFFICIAL.includes(l));
  const noLongerOfficial = EXPECTED_OFFICIAL.filter((l) => !carrying.has(l));

  if (nowOfficial.length > 0) {
    console.error(
      `EFRAG now publishes labels for: ${nowOfficial.join(', ')}.\n` +
        'This is a specification change, not a re-run. The platform authors those labels today, and\n' +
        'NFR-24 requires the official translation wherever one is published — so serving the authored\n' +
        'one would now breach it. Amend T-14, NFR-23, NFR-24, UX-47 and UX-98 together, add the locale\n' +
        'to EXPECTED_OFFICIAL, and extract it here.',
    );
    process.exit(1);
  }
  if (noLongerOfficial.length > 0) {
    console.error(
      `EFRAG no longer publishes labels for: ${noLongerOfficial.join(', ')}.\n` +
        'The catalogue would then claim an official standing the package does not support.',
    );
    process.exit(1);
  }

  // Past the two refusals, `EXPECTED_OFFICIAL` and what the package carries agree, so either can
  // answer — and this is deliberately the *package's* answer rather than the constant's. The
  // manifest is then a reading of EFRAG's own files, which is what makes it re-derivable rather
  // than a claim someone maintained.
  return Object.fromEntries(
    LIVE_LOCALES.map((l) => [
      l,
      carrying.has(l) ? LABEL_STANDING.OFFICIAL : LABEL_STANDING.PLATFORM_AUTHORED,
    ]),
  );
};

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decodeEntities = (text) =>
  text.replace(/&(?:(amp|lt|gt|quot|apos)|#(\d+)|#x([0-9a-fA-F]+));/g, (whole, named, dec, hex) => {
    if (named) return ENTITIES[named];
    return String.fromCodePoint(Number.parseInt(dec ?? hex, dec ? 10 : 16));
  });

/**
 * Concept name → its English text, per label role, followed through the arcs.
 *
 * **A locator without the `vsme_` prefix is still a `vsme` concept** (task 91.1): EFRAG declares 24
 * of `ListOfDisclosuresMember`'s members with bare ids like `B1ListOfSubsidiariesMember` in
 * `vsme-all.xsd` itself, and a read keyed on the prefix labelled none of them.
 */
const readLabels = (xml) => {
  const locators = new Map();
  for (const m of xml.matchAll(/<link:loc\b[^>]*xlink:href="[^"#]*#([^"]+)"[^>]*xlink:label="([^"]+)"/g)) {
    locators.set(m[2], m[1].replace(/^vsme_/, ''));
  }

  const texts = new Map();
  for (const m of xml.matchAll(/<link:label\b([^>]*)>([\s\S]*?)<\/link:label>/g)) {
    const id = /xlink:label="([^"]+)"/.exec(m[1])?.[1];
    const role = /xlink:role="[^"]*\/([^"/]+)"/.exec(m[1])?.[1];
    // **XML entities are decoded here**, and the first run proved why: `BasisForPreparation`'s label
    // is "Basic &amp; Comprehensive Module", which written verbatim into a catalogue renders as
    // `&amp;` on the screen — an escaping artefact shown to a reader as though it were the
    // standard's own words.
    if (id && role) texts.set(id, { role, text: decodeEntities(m[2].replace(/\s+/g, ' ').trim()) });
  }

  const byRole = { label: new Map(), documentation: new Map() };
  for (const m of xml.matchAll(/<link:labelArc\b[^>]*xlink:from="([^"]+)"[^>]*xlink:to="([^"]+)"/g)) {
    const concept = locators.get(m[1]);
    const resource = texts.get(m[2]);
    if (concept && resource && byRole[resource.role] && resource.text) {
      byRole[resource.role].set(concept, resource.text);
    }
  }
  return byRole;
};

const files = findFiles(packageDir);
const standing = standingOfLocales(labelledLanguages(files));

const english = files.find((f) => f.endsWith('vsme-label-en.xml'));
if (!english) {
  console.error('no vsme-label-en.xml in the package — the one linkbase this task cannot do without.');
  process.exit(1);
}
const { label: labels, documentation } = readLabels(readFileSync(english, 'utf8'));

const artefact = JSON.parse(
  readFileSync(join('config', 'seed', `vsme-taxonomy.${version}.json`), 'utf8'),
);
const elements = Object.keys(artefact.elements);
/** Every member of every `vsme` enumeration domain — the answers a choice field offers. */
const members = [
  ...new Set(
    Object.values(artefact.enumerations ?? {})
      .filter((domain) => domain.taxonomy === 'vsme')
      .flatMap((domain) => domain.members),
  ),
].sort();

/**
 * **Every registered element must resolve, and the run fails otherwise.** A missing label is not a
 * gap to fill in later: it is an element key rendered raw on a screen, which CLAUDE.md's
 * user-facing-text rule forbids by name and which no gate downstream can distinguish from a label
 * that happens to look like an identifier.
 */
// An artefact with no elements makes every check below vacuous — `unlabelled` is empty, the
// catalogue is `{}`, and the run reports "0 English labels written" as though it succeeded. The
// downstream parity suite was green on exactly that until 1 Sep 2026, so refuse it at the source.
if (elements.length === 0) {
  console.error(
    `config/seed/vsme-taxonomy.${version}.json registers no elements — nothing to label.`,
  );
  process.exit(1);
}

const unlabelled = elements.filter((key) => !labels.has(key));
if (unlabelled.length > 0) {
  console.error(`${unlabelled.length} registered elements have no English label:`);
  for (const key of unlabelled.slice(0, 10)) console.error(`  ${key}`);
  process.exit(1);
}

// The same refusal the element list gets, for the same reason: an artefact with no `enumerations`
// makes every member check vacuous and writes `members/en.json` as `{}` with nothing to report.
if (members.length === 0) {
  console.error(
    `config/seed/vsme-taxonomy.${version}.json registers no enumeration members — regenerate it with ` +
      'extract-vsme-taxonomy.mjs first.',
  );
  process.exit(1);
}

const unlabelledMembers = members.filter((key) => !labels.has(key));
if (unlabelledMembers.length > 0) {
  console.error(`${unlabelledMembers.length} enumeration members have no English label:`);
  for (const key of unlabelledMembers.slice(0, 10)) console.error(`  ${key}`);
  process.exit(1);
}

const catalogue = Object.fromEntries(elements.sort().map((key) => [key, labels.get(key)]));
const help = Object.fromEntries(
  elements.filter((key) => documentation.has(key)).sort().map((key) => [key, documentation.get(key)]),
);
// `[member]` is XBRL scaffolding the root CLAUDE.md forbids from any surface a person reads — the
// same strip the waste list's names get — so a choice reads *Individual*, not *Individual [member]*.
const memberCatalogue = Object.fromEntries(
  members.map((key) => [key, labels.get(key).replace(/\s*\[member\]$/, '')]),
);
// `disclosure/<taxonomy-version>/{ro,en,ru}.json` — the layout that directory's own README fixes,
// and OQ-45 settled the version identifier as EFRAG's `YYYY-MM-DD`. A version directory is written
// once and never edited: a report authored under one version must still render *that* version's
// labels years later, which is DR-4.
const dir = join('packages', 'i18n', 'catalogues', 'disclosure', version);
mkdirSync(dir, { recursive: true });
const out = join(dir, 'en.json');
writeFileSync(out, `${JSON.stringify(catalogue, null, 2)}\n`);
console.log(`${elements.length} English labels written to ${out}`);

for (const [folder, texts] of [
  ['help', help],
  ['members', memberCatalogue],
]) {
  mkdirSync(join(dir, folder), { recursive: true });
  const file = join(dir, folder, 'en.json');
  writeFileSync(file, `${JSON.stringify(texts, null, 2)}\n`);
  console.log(`${Object.keys(texts).length} English ${folder} entries written to ${file}`);
}

/**
 * **The standing manifest — the fact UX-47 and UX-98 make a reader see, as data.**
 *
 * It sits beside the catalogues rather than in a constant because standing is a property of
 * `(version, locale)` and not of a locale: EFRAG ships the `ro` stub as a file it means to fill, and
 * the release that fills it makes Romanian official **for that version and no earlier one**. A
 * report pinned to `2026-05-01` must still state that its Romanian labels were platform-authored
 * years later, which is DR-4 — the same reason a version directory is written once and never
 * edited. A locale-keyed constant answers one question for all versions at once and is therefore
 * wrong the day a second version registers.
 *
 * Written here rather than by hand so it cannot disagree with what was extracted: the map above is
 * the same computation that decides whether to refuse the run.
 */
const manifest = { version, labels: standing };
const manifestPath = join(dir, 'standing.json');
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(
  `standing written to ${manifestPath}: ` +
    Object.entries(standing)
      .map(([l, s]) => `${l}=${s}`)
      .join(' '),
);
