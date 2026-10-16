import type { ProblemDocument } from '@easyesg/contracts';
import { writeKey, type Refusal, type RefusedWrite } from '@/features/wizard/tools/autosave-state';

/**
 * The api's `refused` items, read as the writes autosave sets aside (task 218; §12.5.6's task-218 row (a), (b)).
 *
 * **Validated rather than cast**: they arrive in a success's body or in a problem document's extension, written by
 * whichever release of the api answered, and an item this reader does not recognise must not become a key the queue
 * trusts. **A problem whose `refused` is absent is a refusal of the report**, and none of this applies to it — the
 * queue holds, as before.
 */

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === 'string';

const isTextOrNull = (value: unknown): value is string | null => value === null || isText(value);

const isOptionalText = (value: unknown): value is string | undefined => value === undefined || isText(value);

/** The refusal's own words — title and detail, each optional, as a problem document's are. */
function wordsOf(item: Readonly<Record<string, unknown>>): Pick<Refusal, 'title' | 'detail'> | null {
  const { title, detail } = item;
  if (!isOptionalText(title) || !isOptionalText(detail)) return null;
  return { ...(title === undefined ? {} : { title }), ...(detail === undefined ? {} : { detail }) };
}

/** Every item read by `read`, or `null` where the list or any item is not one this reader knows. */
function everyItem(value: unknown, read: (item: Readonly<Record<string, unknown>>) => RefusedWrite | null) {
  if (!Array.isArray(value)) return null;
  const items: RefusedWrite[] = [];
  for (const candidate of value) {
    const item = isRecord(candidate) ? read(candidate) : null;
    if (item === null) return null;
    items.push(item);
  }
  return items;
}

/** The refused answers: each keyed as the queue keyed it, with its field named and its modules. */
export function refusedValues(value: unknown): RefusedWrite[] | null {
  return everyItem(value, (item) => {
    const { elementKey, dimensionKey, ordinal, modules, label, memberLabel } = item;
    const words = wordsOf(item);
    if (
      words === null ||
      !isText(elementKey) ||
      !isText(dimensionKey) ||
      typeof ordinal !== 'number' ||
      !Array.isArray(modules) ||
      !modules.every(isText) ||
      !isTextOrNull(label) ||
      !isTextOrNull(memberLabel)
    ) {
      return null;
    }
    return {
      key: writeKey({ elementKey, dimensionKey, ordinal }),
      refusal: { ...words, label, memberLabel, modules },
    };
  });
}

/** The refused derivation inputs — named by their own key, as the browser names an input. */
export function refusedInputs(value: unknown): RefusedWrite[] | null {
  return everyItem(value, (item) => {
    const words = wordsOf(item);
    if (words === null || !isText(item.inputKey)) return null;
    return { key: writeKey({ inputKey: item.inputKey }), refusal: { ...words, label: null, memberLabel: null, modules: [] } };
  });
}

/**
 * This line, where the problem names it as refused for its own sake — a line is one request, so the problem's own
 * words are the line's. `null` for a refusal of the report, which names no line.
 */
export function refusedLine(input: { readonly problem: ProblemDocument; readonly lineId: string }): RefusedWrite | null {
  const items = input.problem.extensions?.refused;
  const named = Array.isArray(items) && items.some((item) => isRecord(item) && item.lineId === input.lineId);
  if (!named) return null;
  return {
    key: writeKey({ lineId: input.lineId }),
    refusal: {
      ...(input.problem.title === undefined ? {} : { title: input.problem.title }),
      ...(input.problem.detail === undefined ? {} : { detail: input.problem.detail }),
      label: null,
      memberLabel: null,
      modules: [],
    },
  };
}
