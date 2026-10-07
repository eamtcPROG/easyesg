/**
 * The calculator's Query keys (task 39.2). **One per report**: S-09's board and its summary read the same figures, and
 * one key is what makes them one read rather than two that can disagree.
 */
export const calculatorQueryKey = (reportId: string) => ['calculator', reportId] as const;
