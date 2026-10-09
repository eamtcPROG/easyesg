import { DOCUMENT_MODULE, type DocumentModule, type ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { DOCUMENT_MARK } from './document-marks';
import { Mark } from './mark';
import { moduleName } from './module-name';
import { ModuleTable } from './module-table';

/**
 * One module, a page of its own: its narrative under each disclosure's label, then its table — or, omitted whole as
 * classified or sensitive, its omission alone (FR-31), or, ruled out by the report's answers, that it does not apply
 * (FR-28) — and never a blank page that says nothing.
 */
export function ModulePage(props: {
  readonly module: DocumentModule;
  readonly document: ReportDocument;
  readonly words: DocumentWords;
}) {
  const { module, words } = props;
  const title = `${module.module}-title`;
  const empty = module.narrative.length === 0 && module.rows.length === 0;
  return (
    <section className="page" id={module.module} aria-labelledby={title}>
      <h2 id={title}>
        <span className="code">{module.module}</span>
        {moduleName(words, module.module)}
      </h2>
      {module.standing === DOCUMENT_MODULE.OMITTED ? (
        <p>
          {words.t('module.omitted')}
          <Mark mark={DOCUMENT_MARK.OMITTED} words={words} />
        </p>
      ) : module.standing === DOCUMENT_MODULE.RULED_OUT ? (
        <p>{words.t('module.ruledOut')}</p>
      ) : (
        <>
          {module.narrative.map((block, index) => (
            <section key={`${block.label ?? ''}|${index}`}>
              <h3>{block.label}</h3>
              <p className="narrative">{block.text}</p>
            </section>
          ))}
          {module.rows.length === 0 ? null : <ModuleTable module={module} document={props.document} words={words} />}
          {empty ? <p>{words.t('module.nothing')}</p> : null}
        </>
      )}
    </section>
  );
}
