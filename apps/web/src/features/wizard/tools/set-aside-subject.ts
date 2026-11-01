import { reportCalculatorRoute } from '@/lib/routes';
import { isDerivationInputWrite, isQueuedLine, type SetAsideWrite } from './autosave-state';
import { fieldHref } from './field-anchor';

/** What a set-aside write is about, as the banner names it (task 218). */
export const SET_ASIDE_SUBJECT = { FIELD: 'field', INPUT: 'input', LINE: 'line' } as const;

export type SetAsideSubject =
  | {
      readonly kind: typeof SET_ASIDE_SUBJECT.FIELD;
      /** The field's name and its member's, as the api named them; `null` where the version names nothing. */
      readonly label: string | null;
      readonly memberLabel: string | null;
      /** The field's own address, on the first step presenting it, or `null` where no step does. */
      readonly href: string | null;
    }
  | { readonly kind: typeof SET_ASIDE_SUBJECT.INPUT }
  | { readonly kind: typeof SET_ASIDE_SUBJECT.LINE; readonly href: string };

/**
 * A set-aside write's subject (task 218; §12.5.6's task-218 row (3)) — **an answer is named and led to its field**, as a
 * finding is (task 42.3), on whichever step presents it, so a refusal made on B3 is still named on B5. A line leads to
 * S-09; an input, which the browser names from its own catalogue, is named by what it is.
 */
export function setAsideSubject(input: { readonly reportId: string; readonly item: SetAsideWrite }): SetAsideSubject {
  const { item, reportId } = input;
  if (isQueuedLine(item.write)) return { kind: SET_ASIDE_SUBJECT.LINE, href: reportCalculatorRoute({ reportId }) };
  if (isDerivationInputWrite(item.write)) return { kind: SET_ASIDE_SUBJECT.INPUT };
  const step = item.refusal.modules[0];
  return {
    kind: SET_ASIDE_SUBJECT.FIELD,
    label: item.refusal.label,
    memberLabel: item.refusal.memberLabel,
    href:
      step === undefined
        ? null
        : fieldHref({
            reportId,
            module: step,
            field: {
              elementKey: item.write.elementKey,
              dimensionKey: item.write.dimensionKey ?? '',
              ordinal: item.write.ordinal ?? 0,
            },
          }),
  };
}
