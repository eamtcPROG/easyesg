import { isAnswered, type FieldAddress, type FieldValue } from '@easyesg/validation';

/** One listed field's row as it stands now, and when it was last written. */
export interface CurrentAnswer {
  readonly value: FieldValue;
  readonly updatedAt: Date;
}

const keyOf = (address: FieldAddress): string => `${address.elementKey}\u0000${address.dimensionKey}\u0000${address.ordinal}`;

/**
 * Whether a write has cleared everything the last run listed as outstanding (task 51.2; `architecture.md` §12.5.6's
 * task-51.2 row (4); 182/134's *disclosure supplied* and *section declared omitted*) — **nothing evaluated**, so 182/26
 * stands: judged against the last run's own list.
 *
 * A listed field counts as cleared when it has **left the report's scope** — a section declared omitted takes its
 * fields out — or **holds an answer written since the run**. *Since the run* is what keeps a field held by a
 * consistency finding from clearing on a write that never touched it: it was answered when the run found it wrong, and
 * only an answer given after the run can be the correction. Whether that correction is right is the next check's to
 * say, the backstop 182/134 names. `inScope` is `null` where the write could not have moved the scope.
 */
export function outstandingCleared(input: {
  readonly listed: readonly FieldAddress[];
  readonly answers: readonly CurrentAnswer[];
  readonly ranAt: Date;
  readonly inScope: ReadonlySet<string> | null;
}): boolean {
  if (input.listed.length === 0) return false;
  const answeredSince = new Set(
    input.answers
      .filter((answer) => isAnswered(answer.value) && answer.updatedAt > input.ranAt)
      .map((answer) =>
        keyOf({
          elementKey: answer.value.elementKey,
          dimensionKey: answer.value.dimensionKey ?? '',
          ordinal: answer.value.ordinal ?? 0,
        }),
      ),
  );
  return input.listed.every(
    (field) => (input.inScope !== null && !input.inScope.has(field.elementKey)) || answeredSince.has(keyOf(field)),
  );
}
