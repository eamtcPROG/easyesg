import { Fragment } from 'react';
import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { EXPLAINED_MARKS } from './document-marks';
import { Mark } from './mark';
import { moduleName } from './module-name';

/** The contents, each entry a link to its page, and how to read the marks — each in its words, none by colour. */
export function ContentsPage({ document, words }: { readonly document: ReportDocument; readonly words: DocumentWords }) {
  return (
    <section className="page" id="contents" aria-labelledby="contents-title">
      <h2 id="contents-title">{words.t('contents.title')}</h2>
      <ol className="contents">
        <li>
          <a href="#omissions">{words.t('omissions.title')}</a>
        </li>
        {document.modules.map((module) => (
          <li key={module.module}>
            <a href={`#${module.module}`}>
              <span className="code">{module.module}</span>
              {moduleName(words, module.module)}
            </a>
          </li>
        ))}
        <li>
          <a href="#provenance">{words.t('provenance.title')}</a>
        </li>
      </ol>
      <h3>{words.t('legend.title')}</h3>
      <p>{words.t('legend.intro')}</p>
      <dl className="legend">
        {EXPLAINED_MARKS.map((mark) => (
          <Fragment key={mark}>
            <dt>
              <Mark mark={mark} words={words} />
            </dt>
            <dd>{words.t(`marks.${mark}.meaning`)}</dd>
          </Fragment>
        ))}
      </dl>
    </section>
  );
}
