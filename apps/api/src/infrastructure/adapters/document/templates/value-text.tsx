import { DOCUMENT_VALUE, type DocumentValue } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { DOCUMENT_MARK } from './document-marks';
import { Mark } from './mark';

/**
 * One value as the document prints it. **A nil return is a stated zero with its mark, and a not-available answer is its
 * mark and the reason** — never a blank, so a reader can always tell a zero from a gap (UX-119; FR-30, FR-32).
 */
export function ValueText({ value, words }: { readonly value: DocumentValue; readonly words: DocumentWords }) {
  switch (value.kind) {
    case DOCUMENT_VALUE.FIGURE:
    case DOCUMENT_VALUE.MONEY:
      return <>{words.figure(value.value, value.places)}</>;
    case DOCUMENT_VALUE.YEAR:
      return <>{value.value}</>;
    case DOCUMENT_VALUE.TEXT:
      return <span className="narrative">{value.text}</span>;
    case DOCUMENT_VALUE.YES_NO:
      return <>{words.t(value.value ? 'values.yes' : 'values.no')}</>;
    case DOCUMENT_VALUE.DATE:
      return <>{words.date(value.date)}</>;
    case DOCUMENT_VALUE.CHOICES:
      return <>{words.list(value.labels)}</>;
    case DOCUMENT_VALUE.NIL_RETURN:
      return (
        <>
          {words.figure('0', null)}
          <Mark mark={DOCUMENT_MARK.NIL_RETURN} words={words} />
        </>
      );
    case DOCUMENT_VALUE.NOT_AVAILABLE:
      return (
        <>
          <Mark mark={DOCUMENT_MARK.NOT_AVAILABLE} words={words} />
          {value.reason === null ? null : (
            <span className="reason">{words.t('marks.notAvailable.reason', { reason: value.reason })}</span>
          )}
        </>
      );
    case DOCUMENT_VALUE.UNANSWERED:
      return <Mark mark={DOCUMENT_MARK.NO_ANSWER} words={words} />;
  }
}
