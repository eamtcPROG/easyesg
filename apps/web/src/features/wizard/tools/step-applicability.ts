import type { DerivationInput, DisclosureField } from '@easyesg/contracts';

/**
 * Which questions a reporter is actually asked — pure, so the rules that had already been got wrong
 * twice are three unit specs rather than three browser journeys (task 134's parent-close review;
 * they lived inside the step's section until then).
 *
 * **§7.3's third condition, which nothing implemented until task 36.9**: *"Not applicable — **Not
 * rendered**. The system never renders a field and then refuses its value on grounds it already
 * knew (P2)."* Before it, only the *module* carried the verdict, on the rail, so B8's turnover was
 * shown to a ten-employee company and B10's pay gap to everyone. **`applicable` alone, and UX-28 is
 * not an exception to it** (convention review, 9 Sep 2026): UX-28 presupposes the disappearance
 * and asks that the **value** survive it, which is storage and the wire — §12.5.6's task-91.3 row
 * settled where that retention lives, *"retained and returned, marked by `applicable: false`
 * beside a state that is not `missing`"*.
 */
export const askedFields = (fields: readonly DisclosureField[]): DisclosureField[] =>
  fields.filter((field) => field.applicable);

/**
 * The elements the step *derives*, which the reporter does not type (FR-29; task 36.10). **Read off
 * the inputs rather than off a flag on the field**, so the two cannot disagree: a figure is derived
 * exactly when something is registered as feeding it, and that is the same fact the api refuses a
 * write against. A field marked derived with nothing feeding it would render permanently read-only
 * and permanently empty.
 */
export const derivedElements = (inputs: readonly DerivationInput[]): ReadonlySet<string> =>
  new Set(inputs.map((input) => input.derives));

/**
 * The inputs actually worth asking — those feeding a figure this reporter is asked for (FR-28,
 * BR-APP-5; found by the B8 browser journey, 9 Sep 2026). **An input outlives nothing.** B8's three
 * turnover figures exist only to produce `EmployeeTurnoverRate`, which applies at fifty employees;
 * below it, asking a ten-person undertaking how many people left is asking a question whose only
 * answer is a disclosure they do not make. `asked` already carries the api's applicability verdict,
 * so this is that same verdict followed one step further rather than a second rule. **Not filtered
 * in the api**, deliberately: the step serves what the artefact registers, and *shown or not* is the
 * same screen decision `askedFields` is — one place, one rule.
 */
export const askedInputsOf = (input: {
  readonly inputs: readonly DerivationInput[];
  readonly asked: readonly DisclosureField[];
}): DerivationInput[] => {
  const applicable = new Set(input.asked.map((field) => field.elementKey));
  return input.inputs.filter((candidate) => applicable.has(candidate.derives));
};
