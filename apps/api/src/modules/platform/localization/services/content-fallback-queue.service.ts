import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  type OnModuleInit,
} from '@nestjs/common';
import type { FallbackReport } from '@easyesg/i18n';
import type { ContentFallbackReporter, ContentFallbackSettlement } from '@api/contracts/content-fallback.port';
import { CONTENT_FALLBACK_WRITE_INTERVAL_MS } from '../constants/content-fallback.constants';
import { FallbackGathering } from '../domain/fallback-gathering';
import { CONTENT_FALLBACK_STORE, type ContentFallbackStore } from '../interfaces/content-fallback-store.interface';

/**
 * FR-64's runtime queue (task 76; UC-14, UC-74; `architecture.md` §12.5.6's task-76 row (5)) — `platform/localization`'s
 * by §6.6, and behind both faces of `content-fallback.port.ts`.
 *
 * **A read writes nothing in its own request.** `report` gathers in the process and answers at once — the port's own
 * `void` — and the gathered counts are written every interval, one upsert per row, so a gap many readers meet costs one
 * statement per interval rather than one per reader: the volume 182/38 declined an occurrence log over.
 *
 * **A failed write is logged and its counts dropped**, not kept for the next: the count orders the work and the next
 * reader of the same gap reports it again, while a queue that kept growing through a database outage would be the
 * process's memory paying for a work list. Written once more before the process stops (`beforeApplicationShutdown`,
 * which runs while the connection is still open).
 */
@Injectable()
export class ContentFallbackQueue
  implements ContentFallbackReporter, ContentFallbackSettlement, OnModuleInit, BeforeApplicationShutdown
{
  private readonly logger = new Logger(ContentFallbackQueue.name);
  private readonly gathering = new FallbackGathering();
  private timer?: NodeJS.Timeout;

  constructor(@Inject(CONTENT_FALLBACK_STORE) private readonly store: ContentFallbackStore) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.write(), CONTENT_FALLBACK_WRITE_INTERVAL_MS);
    this.timer.unref();
  }

  async beforeApplicationShutdown(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.write();
  }

  report(report: FallbackReport): void {
    this.gathering.add(report);
  }

  async settle(input: { readonly translated: readonly FallbackReport[] }): Promise<void> {
    await this.write();
    await this.store.clear({ translated: input.translated.map(({ key, locale }) => ({ key, locale })) });
  }

  /** Writes what readers met since the last write. Public for the suites, which cannot wait out an interval. */
  async write(): Promise<void> {
    const gathered = this.gathering.take();
    if (gathered.length === 0) return;
    try {
      await this.store.record({ gathered });
    } catch (error) {
      this.logger.error(
        `The translation queue could not record ${gathered.length} gap(s); their counts are dropped and the next reader reports them again`,
        error as Error,
      );
    }
  }
}
