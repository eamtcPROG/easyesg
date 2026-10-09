import type { DocumentWords } from '../document-words';
import { MARK_CLASS, type DocumentMark } from './document-marks';

/** One mark, in its words and its outline (UX-119, UX-121). */
export function Mark({ mark, words }: { readonly mark: DocumentMark; readonly words: DocumentWords }) {
  return <span className={`mark ${MARK_CLASS[mark]}`}>{words.t(`marks.${mark}.name`)}</span>;
}
