import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import type { Locale } from '@easyesg/i18n';
import type { GatheredFallback } from '@api/modules/platform/localization/domain/fallback-gathering';
import type { ContentFallbackStore } from '@api/modules/platform/localization/interfaces/content-fallback-store.interface';
import { CORE_DATA_SOURCE } from '../data-source';

/**
 * `CONTENT_FALLBACK_STORE` (task 76; `1793491200000-content-fallback.ts`). **On the `DataSource`**, not a request's
 * runner: the queue writes from its own timer, outside any request, and the table names no organization and has no row
 * security. Each call is one statement — the gathered rows as parallel arrays through `unnest` — so a write is atomic
 * and its times are one `now()`.
 */
@Injectable()
export class ContentFallbackStoreRepository implements ContentFallbackStore {
  constructor(@InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource) {}

  async record(input: { readonly gathered: readonly GatheredFallback[] }): Promise<void> {
    if (input.gathered.length === 0) return;
    await this.dataSource.query(
      `INSERT INTO config.content_fallback AS f (content_key, locale, occurrences)
       SELECT * FROM unnest($1::text[], $2::text[], $3::bigint[])
       ON CONFLICT (content_key, locale) DO UPDATE
         SET occurrences  = f.occurrences + excluded.occurrences,
             last_seen_at = now()`,
      [
        input.gathered.map((row) => row.key),
        input.gathered.map((row) => row.locale),
        input.gathered.map((row) => row.occurrences),
      ],
    );
  }

  async clear(input: { readonly translated: readonly { readonly key: string; readonly locale: Locale }[] }): Promise<void> {
    if (input.translated.length === 0) return;
    await this.dataSource.query(
      `DELETE FROM config.content_fallback f
        USING unnest($1::text[], $2::text[]) AS t (content_key, locale)
        WHERE f.content_key = t.content_key AND f.locale = t.locale`,
      [input.translated.map((pair) => pair.key), input.translated.map((pair) => pair.locale)],
    );
  }
}
