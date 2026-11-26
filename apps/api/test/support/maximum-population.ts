import { randomUUID } from 'node:crypto';
import { RULE_KIND, type Rule } from '@easyesg/validation';
import request from 'supertest';
import { DISCLOSURE_KIND, type DisclosureKind } from '@api/contracts/taxonomy-registry.port';
import { MAX_VALUES_PER_WRITE } from '@api/modules/core/disclosure/dto/wizard-step.dto';
import { DISCLOSURE_ORIGIN } from '@api/modules/core/disclosure/models/disclosure-value.model';
import { INPUT_ANSWER } from '@api/modules/core/disclosure/models/derivation.model';
import { OMITTED_DISCLOSURES_ELEMENT } from '@api/modules/core/disclosure/models/omission.model';

/**
 * **The maximum-population fixture** (task 213; NFR-39, NFR-40; `architecture.md` §12.5.6's task-213 row): a Basic report
 * answered the way a reporter answers it, through the api's own reads and writes, to the largest report the platform can
 * file.
 *
 * **Driven by the wizard's own step reads, not by a list kept here.** Each Basic step says which fields it asks, of
 * which kind, with which choices and units, which rows a closed axis offers and which fields the platform derives; the
 * fixture answers every field a reporter may, in the form its kind takes. So an element added to the taxonomy is in the
 * fixture the day it is served, and an answer the api would refuse is a failure here rather than a smaller fixture.
 *
 * **Every list at the template's capacity** (row (1)): an open list — sites, subsidiaries, materials — to its hundredth
 * position, and a closed axis to its first hundred members, or all of them where it has fewer. Answers open further
 * fields through applicability, so the steps are read again after each pass until a pass finds nothing left to answer.
 * **A field's default is taken as a reporter takes it** — the scope's basis for preparation, the record's legal form —
 * and every other field is answered in its kind's form, an address where a rule judges one. One field is left as most
 * reporters leave it: the declaration of omitted sections, which would take whole sections out of the run the fixture
 * exists to load.
 */

/** The EFRAG Digital Template's rows per list, the most the Excel export can file (`workbook-rows.ts`). */
export const TEMPLATE_ROWS = 100;

/** The Basic Module's steps, B1 … B11. */
const BASIC_MODULES = Array.from({ length: 11 }, (_, index) => `B${index + 1}`);

const SENTENCE = 'Recorded for the maximum-population fixture.';
const ADDRESS = 'https://populatia-maxima.md/raport';

interface Option {
  readonly value: string;
}
interface StepField {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
  readonly kind: DisclosureKind;
  readonly axes: readonly string[];
  readonly repeating: boolean;
  readonly origin: string;
  readonly derived: boolean;
  readonly followsScope: boolean;
  readonly applicable: boolean;
  readonly options: readonly Option[] | null;
  readonly unitCodes: readonly string[];
  readonly defaultValue: Readonly<Record<string, string | boolean | null>> | null;
}
interface Step {
  readonly fields: readonly StepField[];
  readonly axes: readonly { readonly key: string; readonly members: readonly Option[] }[];
  readonly derivationInputs: readonly { readonly key: string; readonly answer: string }[];
}
interface Address {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
}
type Answer = Pick<StepField, 'options' | 'unitCodes'>;

/** How one report answers: the figure its numbers take, and the elements a rule reads as an address. */
interface Answering {
  readonly figure: string;
  readonly addresses: ReadonlySet<string>;
}

/** What a reporter types into a field of each kind. A kind added to the vocabulary does not compile until it is here. */
const ANSWER_OF_KIND: Readonly<Record<DisclosureKind, (field: Answer, answering: Answering) => Record<string, unknown>>> = {
  [DISCLOSURE_KIND.TEXT]: () => ({ valueText: SENTENCE }),
  [DISCLOSURE_KIND.TEXT_BLOCK]: () => ({ valueText: SENTENCE }),
  [DISCLOSURE_KIND.BOOLEAN]: () => ({ valueBoolean: true }),
  [DISCLOSURE_KIND.DATE]: () => ({ valueDate: '2026-06-30' }),
  [DISCLOSURE_KIND.YEAR]: () => ({ valueText: '2026' }),
  [DISCLOSURE_KIND.MONETARY]: (_, answering) => ({ valueNumeric: answering.figure }),
  [DISCLOSURE_KIND.NUMERIC]: (field, answering) => ({ valueNumeric: answering.figure, ...unitOf(field) }),
  [DISCLOSURE_KIND.PERCENT]: () => ({ valueNumeric: '24' }),
  [DISCLOSURE_KIND.ENUMERATION]: (field) => ({ valueText: choices(field)[0] }),
  [DISCLOSURE_KIND.ENUMERATION_SET]: (field) => ({ valueText: choices(field).slice(0, 3).join(' ') }),
};

const unitOf = (field: Answer): Record<string, unknown> =>
  field.unitCodes.length === 0 ? {} : { unitCode: field.unitCodes[0] };

const choices = (field: Answer): string[] => {
  const offered = (field.options ?? []).map((option) => option.value);
  if (offered.length === 0) throw new Error('a choice field offers no choices');
  return offered;
};

const keyOf = (address: Address): string => `${address.elementKey}|${address.dimensionKey}|${address.ordinal}`;

/** The default a field offers at its row, as the write takes it, or `null` where it offers none. */
function defaultOf(field: StepField | undefined): Record<string, unknown> | null {
  const offered = Object.entries(field?.defaultValue ?? {}).filter(([, value]) => value !== null);
  return offered.length === 0 ? null : Object.fromEntries(offered);
}

/** What a reporter gives at one row: the field's default there, an address where a rule reads one, or its kind's answer. */
const answerAt = (input: { readonly field: StepField; readonly listed?: StepField; readonly answering: Answering }) =>
  defaultOf(input.listed) ??
  (input.answering.addresses.has(input.field.elementKey)
    ? { valueText: ADDRESS }
    : ANSWER_OF_KIND[input.field.kind](input.field, input.answering));

/** The rows a reporter fills for one element: every position of an open list, every offered member of a closed axis. */
function rowsOf(field: StepField, step: Step, listed: readonly StepField[]): Address[] {
  if (field.repeating) {
    return Array.from({ length: TEMPLATE_ROWS }, (_, ordinal) => ({ elementKey: field.elementKey, dimensionKey: field.dimensionKey, ordinal }));
  }
  const axis = step.axes.find((offered) => field.axes.includes(offered.key));
  const members = axis === undefined ? [] : axis.members.slice(0, TEMPLATE_ROWS).map((member) => member.value);
  const rows = [...listed.map(({ dimensionKey }) => dimensionKey), ...members];
  return [...new Set(rows)].map((dimensionKey) => ({ elementKey: field.elementKey, dimensionKey, ordinal: 0 }));
}

/** Whether a reporter answers this field: applicable, not the platform's to compute, and not the omission declaration. */
const isAnswered = (field: StepField): boolean =>
  field.applicable &&
  !field.derived &&
  field.origin === DISCLOSURE_ORIGIN.REPORTED &&
  field.elementKey !== OMITTED_DISCLOSURES_ELEMENT;

export interface PopulatedReport {
  /** Values written, each a row a reporter answered. */
  readonly values: number;
  /** Derivation inputs written. */
  readonly inputs: number;
}

/** Answers every Basic field a reporter may, every list at the template's capacity, until nothing is left to answer. */
export async function populateToTheCeiling(input: {
  readonly server: Parameters<typeof request>[0];
  readonly authorization: Record<string, string>;
  readonly reportId: string;
  /** What every number is answered with — a different figure per year moves each comparable answer between them. */
  readonly figure: string;
}): Promise<PopulatedReport> {
  const http = () => request(input.server);
  const report = `/api/v1/reports/${input.reportId}`;
  const rules = ((await http().get(`${report}/validation/rules`).set(input.authorization).expect(200)).body as {
    object: { ruleSet: { rules: readonly Rule[] } };
  }).object.ruleSet.rules;
  const answering: Answering = {
    figure: input.figure,
    addresses: new Set(rules.flatMap((rule) => (rule.kind === RULE_KIND.URL ? rule.fields.map(({ element }) => element) : []))),
  };
  const written = new Set<string>();
  const inputsWritten = new Set<string>();

  for (let pass = 0; ; pass += 1) {
    if (pass === 5) throw new Error('the fixture was still finding fields to answer after five passes');
    const values: Record<string, unknown>[] = [];
    const inputs: Record<string, unknown>[] = [];
    for (const module of BASIC_MODULES) {
      const step = ((await http().get(`${report}/modules/${module}`).set(input.authorization).expect(200)).body as {
        object: Step;
      }).object;
      const byElement = Map.groupBy(step.fields.filter(isAnswered), (field) => field.elementKey);
      for (const [, listed] of byElement) {
        const listedAt = new Map(listed.map((field) => [keyOf(field), field]));
        for (const address of rowsOf(listed[0], step, listed)) {
          if (written.has(keyOf(address))) continue;
          written.add(keyOf(address));
          const answer = answerAt({ field: listed[0], listed: listedAt.get(keyOf(address)), answering });
          values.push({ ...address, ...answer, state: 'ok' });
        }
      }
      for (const derivation of step.derivationInputs) {
        if (inputsWritten.has(derivation.key)) continue;
        inputsWritten.add(derivation.key);
        inputs.push({ inputKey: derivation.key, valueNumeric: derivation.answer === INPUT_ANSWER.YES_NO ? '1' : input.figure });
      }
    }
    if (values.length === 0 && inputs.length === 0) return { values: written.size, inputs: inputsWritten.size };

    for (let start = 0; start < values.length; start += MAX_VALUES_PER_WRITE) {
      const batch = values.slice(start, start + MAX_VALUES_PER_WRITE);
      const answered = await http().put(`${report}/values`).set(input.authorization).send({ values: batch });
      const outcome = (answered.body as { object?: { refused?: unknown[] } }).object;
      if (answered.status !== 200 || (outcome?.refused?.length ?? 0) > 0) {
        const bytes = JSON.stringify({ values: batch }).length;
        throw new Error(`the api refused part of the fixture (${batch.length} values, ${bytes} bytes): ${answered.status} ${JSON.stringify(answered.body).slice(0, 2000)}`);
      }
    }
    if (inputs.length > 0) {
      const answered = await http().put(`${report}/derivation-inputs`).set(input.authorization).send({ values: inputs });
      const outcome = (answered.body as { object?: { refused?: unknown[] } }).object;
      if (answered.status !== 200 || (outcome?.refused?.length ?? 0) > 0) {
        throw new Error(`the api refused a derivation input: ${answered.status} ${JSON.stringify(answered.body).slice(0, 2000)}`);
      }
    }
  }
}

interface Calculator {
  readonly factorSet: { readonly sources: readonly { readonly key: string; readonly units: readonly string[] }[] } | null;
  readonly sites: readonly { readonly ordinal: number }[];
  readonly months: readonly string[] | null;
}

/** What the calculator holds once every line is added: its sites, the factor set's sources, and a line per pair. */
export interface CalculatorLines {
  readonly sites: number;
  readonly sources: number;
  readonly lines: number;
}

/**
 * **A full set of sites, sources and fuels** (NFR-40; row (4)): every source of the factor set in force at every site the
 * report holds, each line in its source's first unit with its twelve months where the period offers the monthly form. A
 * line is one request, so they are sent eight at a time.
 */
export async function addEveryCalculatorLine(input: {
  readonly server: Parameters<typeof request>[0];
  readonly authorization: Record<string, string>;
  readonly reportId: string;
}): Promise<CalculatorLines> {
  const http = () => request(input.server);
  const calculator = `/api/v1/reports/${input.reportId}/calculator`;
  const read = ((await http().get(calculator).set(input.authorization).expect(200)).body as { object: Calculator }).object;
  if (read.factorSet === null) throw new Error('no factor set serves the fixture’s period');
  const sources = read.factorSet.sources;
  const lines = read.sites.flatMap((site) =>
    sources.map((source) => ({
      siteOrdinal: site.ordinal,
      sourceKey: source.key,
      description: `${source.key} at site ${site.ordinal + 1}`,
      unitCode: source.units[0],
      ...(read.months === null ? { quantity: '1200' } : { monthlyQuantities: read.months.map(() => '100') }),
    })),
  );
  const LINES_AT_ONCE = 8;
  for (let start = 0; start < lines.length; start += LINES_AT_ONCE) {
    await Promise.all(
      lines.slice(start, start + LINES_AT_ONCE).map((line) =>
        http().put(`${calculator}/sources/${randomUUID()}`).set(input.authorization).send(line).expect(200),
      ),
    );
  }
  return { sites: read.sites.length, sources: sources.length, lines: lines.length };
}

/** The `rank`th percentile of `samples` by nearest rank — the smallest sample at least `rank`% of them do not exceed. */
export function nearestRank(samples: readonly number[], rank: number): number {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil((rank / 100) * sorted.length) - 1];
}
