import type { ReportDocument } from '@api/contracts/report-document.port';
import type { DocumentWords } from '../document-words';
import { DOCUMENT_MARK } from './document-marks';
import { findingText } from './finding-text';
import { Mark } from './mark';
import { moduleName } from './module-name';
import { ValueText } from './value-text';

/**
 * Every gap and every unresolved finding, before the body rather than after it (UX-119, UX-25): a reader who has to
 * hunt for the omissions concludes they were hidden. Each names the disclosure, its mark and its reason, and a finding
 * says what happened — the report does not settle it on the undertaking's behalf.
 */
export function OmissionsPage({ document, words }: { readonly document: ReportDocument; readonly words: DocumentWords }) {
  const omitted = document.omittedModules.length + document.gaps.length;
  return (
    <section className="page" id="omissions" aria-labelledby="omissions-title">
      <h2 id="omissions-title">{words.t('omissions.title')}</h2>
      <p>{words.t('omissions.intro', { count: omitted })}</p>
      {omitted === 0 ? null : (
        <ul className="entries">
          {document.omittedModules.map((module) => (
            <li key={module}>
              <span className="code">{module}</span>
              {moduleName(words, module)}
              <Mark mark={DOCUMENT_MARK.OMITTED} words={words} />
            </li>
          ))}
          {document.gaps.map((gap, index) => (
            <li key={`${gap.module}|${gap.label ?? ''}|${gap.member ?? ''}|${index}`}>
              <span className="code">{gap.module}</span>
              {gap.label}
              {gap.member === null ? null : <span className="member">{gap.member}</span>}
              {gap.withheld || gap.value === null ? (
                <Mark mark={DOCUMENT_MARK.OMITTED} words={words} />
              ) : (
                <ValueText value={gap.value} words={words} />
              )}
            </li>
          ))}
        </ul>
      )}
      <h3>{words.t('findings.title')}</h3>
      {document.findings === null ? (
        <p>{words.t('findings.notChecked')}</p>
      ) : document.findings.length === 0 ? (
        <p>{words.t('findings.none')}</p>
      ) : (
        <ul className="entries">
          {document.findings.map((finding, index) => (
            <li key={`${finding.message}|${index}`}>
              {finding.module === null ? null : <span className="code">{finding.module}</span>}
              {finding.label}
              {finding.member === null ? null : <span className="member">{finding.member}</span>}
              <Mark mark={DOCUMENT_MARK.UNRESOLVED} words={words} />
              <span className="reason">{findingText(finding, words)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
