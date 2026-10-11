import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';

/**
 * The cover (UX-117): which company, which year, which standard and which version of it, in which language — and how
 * many disclosures are omitted and how many checks are unresolved, on the cover itself, so a reader never finds them
 * first on page nine.
 *
 * **Whose words the labels are, beside the language** (UX-98, T-14 as amended; task 44.7): EFRAG's own, or the
 * platform's translation — Romanian and Russian at `2026-05-01` — stated in the document itself, because a bank or a
 * buyer reads the file and not the export dialogue. **When the file was produced** is the file's own fact (NFR-22), in
 * the zone of the report's period, and a preview, which produces no file, prints none.
 */
export function CoverPage({ document, words }: { readonly document: ReportDocument; readonly words: DocumentWords }) {
  const omitted = document.gaps.length + document.omittedModules.length;
  return (
    <section className="page" id="cover" aria-labelledby="cover-title">
      <p className="kicker">{words.t('cover.kicker', { year: String(document.fiscalYear) })}</p>
      <h1 id="cover-title">{document.undertaking}</h1>
      <p className="standard">{words.t('cover.standard')}</p>
      <dl className="facts">
        <dt>{words.t('cover.period')}</dt>
        <dd>{words.range(document.periodStart.date, document.periodEnd.date)}</dd>
        <dt>{words.t('cover.scope')}</dt>
        <dd>{words.t(`scope.${document.scope}`)}</dd>
        <dt>{words.t('cover.version')}</dt>
        <dd>
          {words.t('cover.taxonomy', { version: document.taxonomyVersion })}
          {document.factorSet === null ? null : (
            <span className="attribution">{words.t('cover.factorSet', { factorSet: document.factorSet })}</span>
          )}
        </dd>
        <dt>{words.t('cover.language')}</dt>
        <dd>
          {words.t(`languages.${document.locale}`)}
          {document.labelStanding === null ? null : (
            <span className="attribution">{words.t(`labels.${document.labelStanding}`)}</span>
          )}
        </dd>
        {document.production === null ? null : (
          <>
            <dt>{words.t('cover.produced')}</dt>
            <dd>{words.moment(document.production.generatedAt, document.periodStart.timezone)}</dd>
          </>
        )}
      </dl>
      <p className="summary">
        {words.t('cover.omissions', { count: omitted })}{' '}
        {document.findings === null
          ? words.t('cover.notChecked')
          : words.t('cover.unresolved', { count: document.findings.length })}
      </p>
    </section>
  );
}
