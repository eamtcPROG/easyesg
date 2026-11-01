/**
 * The marks a document prints beside a disclosure (UX-119; task 43) — each told by its words and its outline or fill,
 * never by colour (UX-121). The value is the mark's key in the document's catalogue.
 */
export const DOCUMENT_MARK = {
  NOT_AVAILABLE: 'notAvailable',
  NIL_RETURN: 'nilReturn',
  OMITTED: 'omitted',
  UNRESOLVED: 'unresolved',
  /** A figure the undertaking put in place of one the platform calculated (UX-43). */
  ESTIMATE: 'estimate',
  /** A disclosure an unresolved finding names that holds no answer. */
  NO_ANSWER: 'noAnswer',
} as const;

export type DocumentMark = (typeof DOCUMENT_MARK)[keyof typeof DOCUMENT_MARK];

/** The marks the contents page explains, in the order it explains them. */
export const EXPLAINED_MARKS: readonly DocumentMark[] = [
  DOCUMENT_MARK.NIL_RETURN,
  DOCUMENT_MARK.NOT_AVAILABLE,
  DOCUMENT_MARK.OMITTED,
  DOCUMENT_MARK.ESTIMATE,
  DOCUMENT_MARK.UNRESOLVED,
  DOCUMENT_MARK.NO_ANSWER,
];

/** Each mark's class in `document.css`. */
export const MARK_CLASS: Readonly<Record<DocumentMark, string>> = {
  [DOCUMENT_MARK.NOT_AVAILABLE]: 'mark-not-available',
  [DOCUMENT_MARK.NIL_RETURN]: 'mark-nil-return',
  [DOCUMENT_MARK.OMITTED]: 'mark-omitted',
  [DOCUMENT_MARK.UNRESOLVED]: 'mark-unresolved',
  [DOCUMENT_MARK.ESTIMATE]: 'mark-estimate',
  [DOCUMENT_MARK.NO_ANSWER]: 'mark-no-answer',
};
