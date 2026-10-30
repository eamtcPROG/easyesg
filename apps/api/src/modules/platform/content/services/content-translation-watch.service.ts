import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { CONTENT_FALLBACK_SETTLEMENT, type ContentFallbackSettlement } from '@api/contracts/content-fallback.port';
import { CONFIG_POLL_INTERVAL_MS } from '@api/infrastructure/configuration/configuration.constants';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { PublishedContentReader } from './published-content-reader.service';

/**
 * Takes a gap off FR-64's queue once its translation is published (task 76; 182/38; `architecture.md` §12.5.6's task-76
 * row (5)). **On every move of the store's version this replica has seen**, it hands the queue every item and locale
 * that carries text now, and the queue writes what it gathered before deleting them — so a gap this replica gathered
 * from its cache before the publication cannot outlive it. Every replica settles when its own cache moves, so none
 * leaves a row behind; the deletions overlap and are idempotent.
 *
 * **Here and not in the queue**, because which pairs are translated is a reading of FR-61's payloads, which is this
 * module's, and the queue knows nothing of what a key names (OQ-44). Checked at the store's own poll: a version this
 * replica has not seen cannot have moved. A settlement that fails is logged and tried again on the next tick.
 */
@Injectable()
export class ContentTranslationWatch implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(ContentTranslationWatch.name);
  private timer?: NodeJS.Timeout;
  private settledVersion: bigint | null = null;
  private settling = false;

  constructor(
    private readonly configurationStore: ConfigurationStore,
    private readonly published: PublishedContentReader,
    @Inject(CONTENT_FALLBACK_SETTLEMENT) private readonly queue: ContentFallbackSettlement,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.settleIfMoved(), CONFIG_POLL_INTERVAL_MS);
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Settles the queue when the store's version has moved since it last did. Public for the suites. */
  async settleIfMoved(): Promise<void> {
    if (this.settling) return;
    const version = this.configurationStore.cachedVersion;
    if (version === this.settledVersion) return;
    this.settling = true;
    try {
      await this.queue.settle({ translated: this.published.translated() });
      this.settledVersion = version;
    } catch (error) {
      this.logger.error('The translation queue could not be settled; it is tried again on the next tick', error as Error);
    } finally {
      this.settling = false;
    }
  }
}
