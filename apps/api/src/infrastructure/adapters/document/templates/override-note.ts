import { DOCUMENT_VALUE, type DocumentOverride, type DocumentValue } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';

/**
 * The note an overridden figure carries (UX-43; FR-36): the figure the undertaking gave, the one the platform
 * calculated and it superseded, the reason, and who replaced it (task 39.4) — each sentence only where its fact is held.
 */
export function overrideNote(input: {
  readonly value: DocumentValue;
  readonly override: DocumentOverride;
  readonly words: DocumentWords;
}): string {
  const { value, override, words } = input;
  const reported =
    value.kind === DOCUMENT_VALUE.FIGURE || value.kind === DOCUMENT_VALUE.MONEY ? words.figure(value.value, value.places) : '';
  return [
    override.superseded === null
      ? words.t('override.replacedUncalculated', { reported })
      : words.t('override.replaced', { reported, superseded: words.figure(override.superseded, override.places) }),
    override.reason === null ? '' : words.t('override.reason', { reason: override.reason }),
    override.person === null ? '' : words.t('override.person', { person: override.person }),
  ]
    .filter((sentence) => sentence !== '')
    .join(' ');
}
