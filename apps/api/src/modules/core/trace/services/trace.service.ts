import { Injectable } from '@nestjs/common';
import type { RequestListDto } from '@api/app/dto/request-list.dto';
import { requestLocale } from '@api/infrastructure/persistence/request-context';
import { activityCodesOf, wordEntry } from '../domain/entry-words';
import { HISTORY_SUBJECTS } from '../domain/history-subjects';
import type { HistoryPage, HistorySubject } from '../models/change-history.model';
import { ChangeWordsFactory } from '../providers/change-words.factory';
import { ReadChangeHistory } from '../use-cases/read-change-history.use-case';

/**
 * The Nest-aware seam over UC-47's read (task 84.1): it resolves the reader's language, reads the page, and words it —
 * **the wording is the request's**, since the trail holds what was written and the reader asks in their own language.
 */
@Injectable()
export class TraceService {
  constructor(
    private readonly reads: ReadChangeHistory,
    private readonly words: ChangeWordsFactory,
  ) {}

  async history(input: {
    readonly subject: HistorySubject;
    readonly list: RequestListDto;
  }): Promise<HistoryPage & { readonly take: number }> {
    const read = await this.reads.execute({ subject: input.subject, skip: input.list.skip, take: input.list.take });
    const words = await this.words.wordsFor({
      locale: requestLocale(),
      subject: input.subject.kind,
      context: read.context,
      codes: activityCodesOf(read.entries),
    });
    const { fields } = HISTORY_SUBJECTS[input.subject.kind];
    return {
      entries: read.entries.map((entry) => wordEntry({ entry, fields, words })),
      total: read.total,
      take: input.list.take ?? Math.max(read.total, 1),
    };
  }
}
