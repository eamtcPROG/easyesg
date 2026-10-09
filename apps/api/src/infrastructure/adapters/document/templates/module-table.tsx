import type { DocumentModule, ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { ModuleRow } from './module-row';
import { moduleName } from './module-name';
import { overrideNote } from './override-note';

/**
 * A module's disclosures as one table — this year beside the prior one where there is a comparable prior (FR-45) — and
 * beneath it the notes its overridden figures carry, on the same page as the figure (UX-43).
 */
export function ModuleTable(props: {
  readonly module: DocumentModule;
  readonly document: ReportDocument;
  readonly words: DocumentWords;
}) {
  const { module, document, words } = props;
  const comparatives = document.priorYear !== null;
  let numbered = 0;
  const notes = module.rows.map((row) => (row.override === null ? null : ++numbered));
  return (
    <>
      <table>
        <caption>{words.t('table.caption', { module: module.module, name: moduleName(words, module.module) })}</caption>
        <thead>
          <tr>
            <th scope="col">{words.t('table.disclosure')}</th>
            <th scope="col" className="figure">
              {String(document.fiscalYear)}
            </th>
            {comparatives ? (
              <th scope="col" className="figure">
                {String(document.priorYear)}
              </th>
            ) : null}
            <th scope="col">{words.t('table.unit')}</th>
          </tr>
        </thead>
        <tbody>
          {module.rows.map((row, index) => (
            <ModuleRow
              key={`${row.label ?? ''}|${row.member ?? ''}|${index}`}
              row={row}
              note={notes[index]}
              comparatives={comparatives}
              words={words}
            />
          ))}
        </tbody>
      </table>
      {numbered === 0 ? null : (
        <ol className="notes">
          {module.rows.flatMap((row, index) =>
            row.override === null ? [] : [<li key={index}>{overrideNote({ value: row.value, override: row.override, words })}</li>],
          )}
        </ol>
      )}
    </>
  );
}
