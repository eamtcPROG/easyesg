import { LABEL_CHANGE, type LabelDiffEntry } from '../models/taxonomy-console.model';

/**
 * The labels two versions' catalogues differ by in one locale (task 67.6; A-04's EFRAG label diff, moved from A-03 by
 * §12.5.6's task-67.5 row (6)) — an element whose label only the later version has, only the earlier, or both with a
 * different text. Sorted by element.
 */
export const labelDiff = (input: {
  readonly before: Readonly<Record<string, { readonly text: string }>>;
  readonly after: Readonly<Record<string, { readonly text: string }>>;
}): readonly LabelDiffEntry[] => {
  const elements = [...new Set([...Object.keys(input.before), ...Object.keys(input.after)])].sort();
  return elements.flatMap((element): LabelDiffEntry[] => {
    const before = input.before[element]?.text ?? null;
    const after = input.after[element]?.text ?? null;
    if (before === after) return [];
    const change = before === null ? LABEL_CHANGE.ADDED : after === null ? LABEL_CHANGE.REMOVED : LABEL_CHANGE.CHANGED;
    return [{ element, change, before, after }];
  });
};
