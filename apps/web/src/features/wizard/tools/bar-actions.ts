/**
 * The two actions S-07's bar draws — *Export* and *Review the report* (task 179.1). Declared once since task 179's
 * convention review, for the two parts that draw them: the wider bar's buttons and the ⋯ at `compact`
 * (`ReportOverflow`). *Review the report* opens S-10, the preview, since task 43.2, and *Export* opens S-11 since task
 * 47.3. Directive-free, so a Server Component may read it.
 */
export const BAR_ACTION = { EXPORT: 'export', REVIEW: 'review' } as const;

export type BarAction = (typeof BAR_ACTION)[keyof typeof BAR_ACTION];
