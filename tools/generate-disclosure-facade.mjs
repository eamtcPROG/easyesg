/**
 * Generates the typed disclosure facade from a registered taxonomy version (task 34.2; AD-3, T-3).
 *
 *     node tools/generate-disclosure-facade.mjs <version>
 *
 * **T-3's buy-back, and only the typing half of it.** The disclosure store is element-keyed, so it
 * has no compile-time typing and no per-disclosure check constraint; AD-3 buys that back three ways
 * and this is the first — *"a typed facade generated per taxonomy version, so application code and
 * the API still see `report.b3.scope1Emissions` rather than string keys"*. Rule-driven validation is
 * task 40's and the golden-report corpus is NFR-20's.
 *
 * **Per version, because DR-4 makes two coexist.** A report pinned to `2026-05-01` must still be
 * read against *that* version's elements after a newer one registers, so the generated module is
 * named for its version and never edited afterwards — the same append-only shape the label
 * catalogues use.
 *
 * ## Naming
 *
 * Accessors are the element's own local name, camel-cased, **with digits spelled as words**
 * (project owner, 1 Sep 2026): `GrossScope1GreenhouseGasEmissions` becomes
 * `grossScopeOneGreenhouseGasEmissions`, and module `B11` becomes `bEleven`.
 *
 * Mechanical rather than curated, which is what makes *"a taxonomy addition regenerates it"* true
 * without a human naming step — and it keeps NFR-2's vocabulary, the element local name, as the one
 * source of truth. AD-3's `scope1Emissions` is illustrative prose, and it names an element the
 * published taxonomy does not carry; §7.3 already recorded three invented keys found the same way.
 *
 * **The spelling rule is enforced, not hoped for.** `NUMBER_WORDS` covers what the sources contain
 * — single digits inside element names, modules to eleven — and the run *fails* on a number outside
 * it rather than emitting a digit, so a future `Scope4` or a three-digit module is a build failure
 * with a message rather than an identifier that quietly breaks the convention.
 *
 * It applies to **identifiers only**. Axis member keys become string-literal types rather than
 * property names, so they keep their own spelling — which matters, because the waste and country
 * axes carry keys like `123456` that no spelling rule should touch.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [, , version] = process.argv;
if (!version) {
  console.error('usage: node tools/generate-disclosure-facade.mjs <version>');
  process.exit(1);
}

const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen',
  'Nineteen', 'Twenty',
];

/** `GrossScope1GreenhouseGasEmissions` → `grossScopeOneGreenhouseGasEmissions`. */
const accessor = (name) => {
  const spelled = name.replace(/\d+/g, (digits) => {
    const word = NUMBER_WORDS[Number.parseInt(digits, 10)];
    if (word === undefined) {
      console.error(
        `${name}: no word for ${digits}. Identifiers carry no digits (task 34.2), and the table ` +
          `stops at ${NUMBER_WORDS.length - 1} because that is what the sources contain. Extend ` +
          `NUMBER_WORDS deliberately rather than letting a digit through.`,
      );
      process.exit(1);
    }
    return word;
  });
  return spelled.charAt(0).toLowerCase() + spelled.slice(1);
};

/**
 * The TypeScript a stored value reads back as.
 *
 * `numeric`, `monetary` and `percent` are `string`, not `number`: the column is `numeric` precisely
 * because a double cannot represent 0.1, and handing a caller a `number` would discard at the one
 * boundary the column type exists to protect. `year` is a string for the reason
 * `apps/web/CLAUDE.md` records — a year formatted as a number renders as "2 026".
 */
const VALUE_TYPES = {
  text: 'string',
  text_block: 'string',
  boolean: 'boolean',
  date: 'string',
  year: 'string',
  monetary: 'string',
  numeric: 'string',
  percent: 'string',
  enumeration: 'string',
  enumeration_set: 'readonly string[]',
};

const artefact = JSON.parse(
  readFileSync(join('config', 'seed', `vsme-taxonomy.${version}.json`), 'utf8'),
);

/** Elements the standard files under no numbered module — the three pillar-level catch-alls. */
const UNMODULED = 'general';

const groups = new Map();
for (const [key, element] of Object.entries(artefact.elements)) {
  const group = element.module === null ? UNMODULED : accessor(element.module);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push([key, element]);
}

/**
 * Two renderings, because the same member list appears in both a type and a value position and they
 * are not interchangeable: `'a' | 'b'` is a union where `['a' | 'b']` is an array holding one
 * bitwise-or expression. The first draft used one helper for both, and TypeScript reported it as
 * arithmetic on strings — which is exactly what it was.
 */
const asUnion = (values) => values.map((v) => `'${v}'`).join(' | ');
const asArray = (values) => values.map((v) => `'${v}'`).join(', ');

/**
 * The descriptor for one element — its key, how to read it, and the shape it holds.
 *
 * **The shape follows the element rather than being uniform**, which is the whole of what a typed
 * facade buys: an undimensioned element is a value, an element along an explicit axis is one value
 * per member, and an element along a typed axis is a repeating group the reporter adds rows to. A
 * single `Record<string, unknown>` for all three would compile everywhere and say nothing.
 */
const descriptorOf = (key, element) => {
  const value = VALUE_TYPES[element.kind];
  if (value === undefined) {
    console.error(`${key}: unmapped disclosure kind ${element.kind}`);
    process.exit(1);
  }
  // The artefact omits `axes` entirely for an undimensioned element rather than emitting `[]`,
  // which is worth reading from the file rather than assuming: `element.axes[0]` throws on 109 of
  // the 143.
  const axes = element.axes ?? [];
  const axisKey = axes[0] ?? null;
  const axis = axisKey === null ? null : artefact.axes[axisKey];
  if (axisKey !== null && axis === undefined) {
    console.error(`${key}: names axis ${axisKey}, which this version does not declare`);
    process.exit(1);
  }
  if (axes.length > 1) {
    console.error(
      `${key}: carries ${axes.length} axes. The 2026-05-01 taxonomy has none, so the ` +
        'generated shape models one; a multi-axis element needs a decision, not a guess.',
    );
    process.exit(1);
  }

  if (axis === null) return { holds: `Scalar<${value}>`, axisKey: 'null', members: 'null' };
  if (axis.typed) return { holds: `RepeatingGroup<${value}>`, axisKey: `'${axisKey}'`, members: 'null' };
  const members = axis.members.length > 0 ? asUnion(axis.members) : 'string';
  return {
    holds: `Dimensioned<${value}, ${members}>`,
    axisKey: `'${axisKey}'`,
    members: axis.members.length > 0 ? `[${asArray(axis.members)}]` : 'null',
  };
};

const lines = [];
lines.push(`// Generated by tools/generate-disclosure-facade.mjs from`);
lines.push(`// config/seed/vsme-taxonomy.${version}.json. Do not edit.`);
lines.push(`//`);
lines.push(`// A version directory is written once and never edited (DR-4): a report pinned to`);
lines.push(`// ${version} must still read against these elements after a newer version registers.`);
lines.push(`import type { Dimensioned, Disclosure, RepeatingGroup, Scalar } from '../shape.js';`);
lines.push('');
lines.push(`export const TAXONOMY_VERSION = '${version}';`);
lines.push('');

const moduleOrder = [...groups.keys()].sort((a, b) => {
  const order = artefact.modules.map(accessor);
  return order.indexOf(a) - order.indexOf(b);
});

lines.push('/** Every disclosure of this version, grouped as the standard groups them. */');
lines.push('export const DISCLOSURES = {');
for (const group of moduleOrder) {
  const elements = groups.get(group).sort((a, b) => a[1].order - b[1].order);
  lines.push(`  ${group}: {`);
  for (const [key, element] of elements) {
    const { holds, axisKey, members } = descriptorOf(key, element);
    lines.push(`    ${accessor(key)}: {`);
    lines.push(`      key: '${key}',`);
    lines.push(`      kind: '${element.kind}',`);
    lines.push(`      axis: ${axisKey},`);
    lines.push(`      members: ${members},`);
    lines.push(`    } as Disclosure<${holds}>,`);
  }
  lines.push('  },');
}
lines.push('} as const;');
lines.push('');

const dir = join('packages', 'vsme', 'src', 'generated');
const out = join(dir, `${version}.ts`);
writeFileSync(out, `${lines.join('\n')}\n`);

const count = Object.keys(artefact.elements).length;
console.log(`${count} disclosures in ${moduleOrder.length} groups written to ${out}`);

// The convention this file exists to keep, asserted against its own output rather than trusted.
const emitted = readFileSync(out, 'utf8');
const identifiers = [...emitted.matchAll(/^\s{2,4}([A-Za-z][A-Za-z0-9]*):/gm)].map((m) => m[1]);
const withDigits = identifiers.filter((name) => /\d/.test(name));
if (withDigits.length > 0) {
  console.error(`identifiers carrying digits: ${withDigits.join(', ')}`);
  process.exit(1);
}
console.log('no generated identifier carries a digit');
