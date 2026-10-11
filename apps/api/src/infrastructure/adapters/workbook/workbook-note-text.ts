import { type NotedFigure, WORKBOOK_NOTE, type WorkbookNoteText } from '@api/contracts/report-workbook.port';
import type { DocumentWords } from '../document/document-words';
import { findingText } from '../document/templates/finding-text';

/** Where the workbook's own words sit in the committed catalogues (task 46). */
const NAMESPACE = 'core.export.workbook.notes';

/**
 * What one note says, in the export's language (task 46; `architecture.md` §12.5.6's task-46 rows (2), (3), (6), (7)).
 *
 * **The words are the catalogue's** (`core.export.workbook.notes.*`, three locales), **the figures the locale's layout**
 * over values already decided — rounded once, half-up, by the one function the document rounds with (FR-29), each with
 * its unit worded as the document words it. A finding says what it found, its first part (NFR-79), as the document's
 * omissions page says it.
 */
export function workbookNoteText(says: WorkbookNoteText, words: DocumentWords): string {
  const t = (key: string, params?: Readonly<Record<string, unknown>>) => words.message(`${NAMESPACE}.${key}`, params) ?? '';
  const figure = (noted: NotedFigure): string => {
    const unit = noted.unit === null ? '' : words.t(`units.${noted.unit}`);
    return [words.figure(noted.value, noted.places), unit].filter((part) => part !== '').join(' ');
  };
  switch (says.kind) {
    case WORKBOOK_NOTE.OVERRIDE:
      return [
        says.superseded === null
          ? t('override.replacedUncalculated', { reported: figure(says.figure) })
          : t('override.replaced', {
              reported: figure(says.figure),
              superseded: figure({ ...says.figure, value: says.superseded }),
            }),
        says.reason === null ? '' : t('override.reason', { reason: says.reason }),
        says.person === null ? '' : t('override.person', { person: says.person }),
      ]
        .filter((sentence) => sentence !== '')
        .join(' ');
    case WORKBOOK_NOTE.NOT_AVAILABLE:
      return says.reason === null ? t('notAvailable.plain') : t('notAvailable.reason', { reason: says.reason });
    case WORKBOOK_NOTE.FINDING:
      return t('finding', {
        happened: findingText({ module: null, label: null, member: null, message: says.message, params: says.params }, words),
      });
    case WORKBOOK_NOTE.OWN_FIGURE:
      return t('ownFigure', { figure: figure(says.figure) });
    case WORKBOOK_NOTE.CONVERTED:
      return t('converted', { figure: figure(says.figure), unit: words.t(`units.${says.written}`) });
    case WORKBOOK_NOTE.NO_UNIT:
      return t('noUnit', { figure: figure(says.figure) });
    case WORKBOOK_NOTE.ALSO:
      return t('also', { figure: figure(says.figure) });
    case WORKBOOK_NOTE.NOT_LISTED:
      return t('notListed', { members: words.list(says.members) });
    case WORKBOOK_NOTE.FACTOR_SET:
      return t('factorSet', { label: says.label });
    case WORKBOOK_NOTE.LABELS:
      return t('labels');
  }
}
