import type { DocumentFinding } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';

const CANONICAL_DECIMAL = /^-?\d+(?:\.\d+)?$/u;

/**
 * What an unresolved finding says happened — the first of its three parts (NFR-79; task 42) — with every figure among
 * its values laid out in the document's language, as S-08 lays them out in the interface's.
 */
export function findingText(finding: DocumentFinding, words: DocumentWords): string {
  const values = Object.fromEntries(
    Object.entries(finding.params).map(([name, value]) => [
      name,
      CANONICAL_DECIMAL.test(value) ? words.figure(value, null) : value,
    ]),
  );
  return words.message(`${finding.message}.happened`, values) ?? '';
}
