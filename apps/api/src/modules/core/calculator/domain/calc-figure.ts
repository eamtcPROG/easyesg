import { B3_ELEMENT_FOR_SCOPE } from '../models/b3-element.model';

/**
 * Whether an element is one of the B3 figures the calculator produces — the only ones UC-34's figure routes may
 * explain or replace (task 38.4). Beside the use cases that ask it rather than in each, so the three agree.
 */
export const isCalcFigure = (elementKey: string): boolean =>
  Object.values(B3_ELEMENT_FOR_SCOPE).includes(elementKey);
