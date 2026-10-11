import type { Locale } from '@easyesg/i18n';
import type { WorkbookFacts } from '@api/contracts/report-workbook.port';
import { ReportNotFoundError } from '@api/modules/core/disclosure/errors/report.errors';
import type { WorkbookSources } from '../domain/report-workbook';
import type { EntityIdentifiersStore } from '../interfaces/entity-identifiers.interface';
import type { ReadReportContents } from './read-report-contents.use-case';

/** A report read for the Digital Template: what is written into it, and the pin naming which template. */
export interface ComposedWorkbook {
  readonly sources: WorkbookSources;
  /** DR-4's two pins, copied from the report — the template the export writes is the one they name, and no other. */
  readonly pin: { readonly templateVersion: string; readonly taxonomyVersion: string };
}

/**
 * The report as the EFRAG Digital Template is given it (task 46.1; FR-50): what `ReadReportContents` reads for the
 * document too — so the PDF and the Excel export cannot say different things about one report (NFR-18) — and the
 * entity's LEI or IDNO, which only the template asks for (OQ-18). No prior period: the template has no cell for one
 * (182/33). It writes nothing.
 */
export class ComposeReportWorkbook {
  constructor(
    private readonly contents: Pick<ReadReportContents, 'execute'>,
    private readonly identifiers: EntityIdentifiersStore,
  ) {}

  async execute(query: {
    readonly reportId: string;
    /** The export's language — the narrative is the reporter's own, and the notes are worded in it (182/31). */
    readonly locale: Locale;
    readonly facts: Omit<WorkbookFacts, 'locale'>;
  }): Promise<ComposedWorkbook> {
    const { reportId, locale } = query;
    const contents = await this.contents.execute({ reportId, locale });
    const identifiers = await this.identifiers.identifiersOf({ reportId });
    if (identifiers === null) throw new ReportNotFoundError();
    const { report } = contents;

    return {
      pin: { templateVersion: report.templateVersion, taxonomyVersion: report.taxonomyVersion },
      sources: {
        report: {
          entityName: report.subject.entityName,
          lei: identifiers.lei,
          idno: identifiers.idno,
          reportingCurrency: report.reportingCurrency,
          periodStart: report.subject.periodStart,
          periodEnd: report.subject.periodEnd,
        },
        fields: [...contents.steps.values()].flatMap((step) => step.fields),
        inputs: [...contents.steps.values()].flatMap((step) => step.derivationInputs),
        inScope: contents.inScope,
        run: contents.run,
        findings: contents.findings,
        precision: contents.precision,
        labelStanding: contents.labelStanding,
        facts: { locale, ...query.facts },
      },
    };
  }
}
