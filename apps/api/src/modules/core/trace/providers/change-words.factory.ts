import { Inject, Injectable } from '@nestjs/common';
import type { Locale } from '@easyesg/i18n';
import { translate } from '@api/app/messages/catalogue';
import { DISCLOSURE_LABELS, type DisclosureLabelResolver } from '@api/contracts/disclosure-label.port';
import { documentWords } from '@api/infrastructure/adapters/document/document-words';
import { NaceCodeLookup } from '@api/modules/core/entity/use-cases/search-nace-codes.use-case';
import { wordAnswer, type AnswerWords } from '../domain/answer-words';
import type { ChangeWords } from '../domain/entry-words';
import type { AnswerContext, HistorySubjectKind } from '../models/change-history.model';

/** Where an entry's own words sit: a field's name, and an activity code beside its label (§12.5.6's task-84 row (e)). */
const NAMESPACE = 'core.trace';

/** The shared catalogue's namespace for a closed vocabulary's words, which the browser reads too (row (e)). */
const VOCABULARY_NAMESPACE = 'vocabulary';

/**
 * Builds the words one page of a subject's history is stated in (task 84.1; §12.5.6's task-84 row (3), (d), (e)), in the
 * reader's language.
 *
 * **A disclosure answer takes the document's words** — `documentWords`, the export's own — so a value reads in its
 * history as the report prints it. **A closed vocabulary's word is the shared catalogue's**, read by the browser too;
 * **an activity code's label is the classifier's**, through the lookup S-13 reads, resolved once for the codes the page
 * names. A field's name is the history's own.
 */
@Injectable()
export class ChangeWordsFactory {
  constructor(
    @Inject(DISCLOSURE_LABELS) private readonly labels: DisclosureLabelResolver,
    private readonly activities: NaceCodeLookup,
  ) {}

  async wordsFor(input: {
    readonly locale: Locale;
    readonly subject: HistorySubjectKind;
    readonly context: AnswerContext | null;
    /** The activity codes the page names — resolved once, rather than per change. */
    readonly codes: readonly string[];
  }): Promise<ChangeWords> {
    const { locale, context } = input;
    const document = documentWords(locale);
    const resolved = input.codes.length === 0 ? [] : await this.activities.resolve({ codes: input.codes, locale });
    const activityLabels = new Map(resolved.map((match) => [match.code, match.label]));
    const members = context === null ? null : this.labels.memberLabels({ version: context.taxonomyVersion, locale });

    const answerWords: AnswerWords = {
      yes: document.t('values.yes'),
      no: document.t('values.no'),
      nilReturn: document.t('marks.nilReturn.name'),
      notAvailable: document.t('marks.notAvailable.name'),
      unit: (code) => document.t(`units.${code}`) || code,
      figure: (value) => document.figure(value, null),
      percent: (value) => document.percent(value, null),
      date: (date) => document.date(date),
      list: (items) => document.list(items),
      member: (key) => members?.[key]?.text ?? null,
    };

    return {
      // An unworded name prints nothing rather than a key (UX-97); `history-wording.spec.ts` holds every one worded.
      field: (key) => translate(locale, `${NAMESPACE}.fields.${input.subject}.${key}`) ?? '',
      term: (vocabulary, term) => translate(locale, `${VOCABULARY_NAMESPACE}.${vocabulary}.${term}`) ?? null,
      activity: (code) => {
        const label = activityLabels.get(code);
        return label === undefined ? code : (translate(locale, `${NAMESPACE}.activity`, { code, label }) ?? code);
      },
      answer: (answer) =>
        wordAnswer({ answer, kind: context?.kind ?? null, currency: context?.currency ?? null, words: answerWords }),
      list: (items) => document.list(items),
    };
  }
}
