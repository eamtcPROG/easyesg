import { FINDING_MESSAGE_PARTS, findingMessagePartKey, type Finding } from '@easyesg/validation';
import type { useFormatter, useTranslations } from 'next-intl';

/**
 * **A finding in the reader's words: its three parts, in reading order** (task 42.1; FR-40 item 6, NFR-79, OQ-43;
 * `architecture.md` §12.5.6's task-42 row (2)) — *what happened*, *so what*, *what now* — or `null` where the catalogue
 * holds no such message.
 *
 * **The one place a rule's message key, which is data, meets the typed catalogue.** A rule names its message
 * (`validation.sum.over`), and `global.d.ts` types the `validation` namespace from the shared catalogue — but a key read
 * off a rule set cannot be a literal the compiler checks, so it is asked with `has` first and translated through a
 * string-keyed view of the same translator. What makes that safe is not this file but the api's publication rule,
 * which refuses a rule set whose message is not worded in its three parts in every locale (182/51's check, reshaped):
 * the `null` here is a rule set the publisher would have refused.
 *
 * **The values a message quotes are formatted in the reader's locale** (NFR-26): a finding carries a decimal as
 * canonical text — `1250000.5` — and an address verbatim, and only the first is a number, so a value is formatted when
 * it reads as a canonical decimal and quoted as it is otherwise. `exact` prints a decimal string as itself, every digit
 * (`i18n/formats.ts`).
 *
 * Pure given the translator and the formatter, which the caller passes — the field's and the panel's.
 */
type ValidationTranslator = ReturnType<typeof useTranslations<'validation'>>;
type Formatter = ReturnType<typeof useFormatter>;
type ValidationKey = Parameters<ValidationTranslator['has']>[0];

/** The namespace a rule's message lives under; a key outside it is not a finding's message. */
const NAMESPACE = 'validation.';

/** The shape `formatDecimal` gives a decimal (task 40.2): an optional sign, digits, and a fraction without trailing zeros. */
const CANONICAL_DECIMAL = /^-?\d+(?:\.\d+)?$/u;

export function findingWords(input: {
  readonly t: ValidationTranslator;
  readonly format: Formatter;
  readonly finding: Pick<Finding, 'message' | 'params'>;
}): readonly string[] | null {
  const { message, params } = input.finding;
  if (!message.startsWith(NAMESPACE)) return null;
  const relative = message.slice(NAMESPACE.length);
  // The data key read as a catalogue key, and the string-keyed view of the typed translator — see the docblock for why
  // these are the one cast, and what makes it safe.
  const keys = FINDING_MESSAGE_PARTS.map((part) => findingMessagePartKey({ message: relative, part }) as ValidationKey);
  if (!keys.every((key) => input.t.has(key))) return null;
  const translate = input.t as unknown as (key: string, values: Readonly<Record<string, string>>) => string;

  const values = Object.fromEntries(
    Object.entries(params).map(([name, value]) => [
      name,
      CANONICAL_DECIMAL.test(value) ? input.format.number(Number(value), 'exact') : value,
    ]),
  );
  return keys.map((key) => translate(key, values));
}
