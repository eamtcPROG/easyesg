import type { DocumentProduction, ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';

/**
 * Every version the figures depend on (UX-117; NFR-22): the template, the taxonomy — with whose words its labels are
 * (UX-98) — the factor set the calculation used, and the language; and, in a file, who generated it and when, which are
 * the file's own facts (task 44) and absent from the preview.
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
        <dd>
          {words.t('provenance.taxonomyVersion', { version: document.taxonomyVersion })}
          {document.labelStanding === null ? null : (
            <span className="attribution">{words.t(`labels.${document.labelStanding}`)}</span>
          )}
        </dd>
        <dt>{words.t('provenance.factorSet')}</dt>
        <dd>{document.factorSet ?? words.t('provenance.noFactorSet')}</dd>
        <dt>{words.t('provenance.language')}</dt>
        <dd>{words.t(`languages.${document.locale}`)}</dd>
        {document.production === null ? null : (
          <>
            <dt>{words.t('provenance.generatedBy')}</dt>
            <dd>{generated(document.production, document.periodStart.timezone, words)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

/** The person and the moment — the moment alone where the account is gone. */
function generated(production: DocumentProduction, timezone: string, words: DocumentWords): string {
  const moment = words.moment(production.generatedAt, timezone);
  return production.generatedBy === null ? moment : words.t('provenance.generated', { person: production.generatedBy, moment });
}
