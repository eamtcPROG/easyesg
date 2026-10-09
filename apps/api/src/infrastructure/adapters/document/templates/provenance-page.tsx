import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';

/**
 * Every version the figures depend on (UX-117; NFR-22): the template, the taxonomy, the factor set the calculation
 * used, and the language. Who generated a file and when are a file's facts, and arrive with the export (task 44).
 */
export function ProvenancePage({ document, words }: { readonly document: ReportDocument; readonly words: DocumentWords }) {
  return (
    <section className="page" id="provenance" aria-labelledby="provenance-title">
      <h2 id="provenance-title">{words.t('provenance.title')}</h2>
      <p>{words.t('provenance.intro')}</p>
      <dl className="terms">
        <dt>{words.t('provenance.template')}</dt>
        <dd>{words.t('provenance.templateVersion', { version: document.templateVersion })}</dd>
        <dt>{words.t('provenance.taxonomy')}</dt>
        <dd>{words.t('provenance.taxonomyVersion', { version: document.taxonomyVersion })}</dd>
        <dt>{words.t('provenance.factorSet')}</dt>
        <dd>{document.factorSet ?? words.t('provenance.noFactorSet')}</dd>
        <dt>{words.t('provenance.language')}</dt>
        <dd>{words.t(`languages.${document.locale}`)}</dd>
      </dl>
    </section>
  );
}
