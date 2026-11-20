import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import {
  LOCALE_REGISTRATION_CONFIG_KIND,
  LOCALE_REGISTRATION_SCOPE,
} from '@api/contracts/locale-offer.port';
import { ConfigurationDraftMissingError } from '@api/infrastructure/configuration/configuration-draft-missing.error';
import { ConfigurationDrafts, type OpenDraft } from '@api/infrastructure/configuration/configuration-drafts.service';
import { ConfigurationPayloadRefusedError } from '@api/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '@api/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationRevisionMismatchError } from '@api/infrastructure/configuration/configuration-revision-mismatch.error';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { SOURCE_LOCALE } from '@easyesg/i18n';
import { CONTENT_KIND, type ContentKind } from '@api/modules/platform/content/constants/content.constants';
import {
  ContentDraftMissingError,
  ContentPayloadRefusedError,
  LocaleRegistrationChangedError,
} from '@api/modules/platform/content/errors/content.errors';
import type {
  ContentConsoleStore,
  ContentSignOff,
} from '@api/modules/platform/content/interfaces/content-console-store.interface';
import {
  CONTENT_DRAFT_STATE,
  type ContentDraft,
  type ContentFallbackEntry,
  type ContentItem,
  type ContentItemRef,
  type LocaleRegistrationView,
} from '@api/modules/platform/content/models/content-console.model';
import { ACQUISITION_PURPOSE } from '@api/modules/platform/support-access/models/support-access-log.model';
import { AdminReadOnly } from '../admin-readonly';
import { CORE_DATA_SOURCE } from '../data-source';

const KINDS: readonly ContentKind[] = Object.values(CONTENT_KIND);

/**
 * A-03's store (task 67.5; §12.5.6's task-67.5 row) — FR-61's three kinds through the configuration store's drafts
 * (67.15) and publications (67.14), read straight from `config.entry_*` rather than the cache, as A-17's and A-18's
 * stores read theirs, so the console shows what the store holds this instant. **The store's errors become this
 * module's refusals here**, and the cache is polled after every publication so this replica serves the change at once.
 */
@Injectable()
export class ContentConsoleStoreRepository implements ContentConsoleStore {
  constructor(
    @InjectDataSource(CORE_DATA_SOURCE) private readonly dataSource: DataSource,
    private readonly drafts: ConfigurationDrafts,
    private readonly publisher: ConfigurationPublisher,
    private readonly configurationStore: ConfigurationStore,
    private readonly adminReadOnly: AdminReadOnly,
  ) {}

  async items(): Promise<readonly ContentItem[]> {
    const rows = await this.dataSource.query<ItemRow[]>(
      `WITH slots AS (
         SELECT kind, scope FROM config.entry_version WHERE kind = ANY($1::text[]) GROUP BY kind, scope
       )
       SELECT slots.kind, slots.scope,
              live.revision AS live_revision, live.payload AS live_payload, live.published_at AS live_published_at,
              publisher.email AS live_published_by,
              EXISTS (SELECT 1 FROM config.entry_version earlier
                       WHERE earlier.kind = slots.kind AND earlier.scope = slots.scope
                         AND earlier.state = 'superseded' AND earlier.revision < live.revision) AS live_revertible,
              draft.id AS draft_id, draft.revision AS draft_revision, draft.state::text AS draft_state,
              draft.payload AS draft_payload, draft.created_at AS draft_at, author.email AS draft_by
         FROM slots
         LEFT JOIN config.entry_schedule s ON s.kind = slots.kind AND s.scope = slots.scope AND s.validity = '[,)'
         LEFT JOIN config.entry_version live ON live.id = s.version_id
         LEFT JOIN identity.admin_account publisher ON publisher.id = live.created_by
         LEFT JOIN config.entry_version draft
                ON draft.kind = slots.kind AND draft.scope = slots.scope
               AND draft.state IN ('${CONTENT_DRAFT_STATE.DRAFT}', '${CONTENT_DRAFT_STATE.IN_REVIEW}')
         LEFT JOIN identity.admin_account author ON author.id = draft.drafted_by
        WHERE live.id IS NOT NULL OR draft.id IS NOT NULL
        ORDER BY slots.kind, slots.scope`,
      [KINDS],
    );
    return rows.flatMap((row) => (isContentKind(row.kind) ? [toItem(row, row.kind)] : []));
  }

  async fallbacks(): Promise<readonly ContentFallbackEntry[]> {
    const rows = await this.dataSource.query<FallbackRow[]>(
      `SELECT content_key, locale, first_seen_at, last_seen_at, occurrences::int AS occurrences
         FROM config.content_fallback ORDER BY occurrences DESC, content_key, locale`,
    );
    return rows.map((row) => ({
      contentKey: row.content_key,
      locale: row.locale,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      occurrences: row.occurrences,
    }));
  }

  async registration(): Promise<LocaleRegistrationView> {
    const rows = await this.dataSource.query<{ revision: number; payload: { locales?: { code?: unknown }[] } }[]>(
      `SELECT v.revision, v.payload FROM config.entry_schedule s JOIN config.entry_version v ON v.id = s.version_id
        WHERE s.kind = $1 AND s.scope = $2 AND s.validity = '[,)'`,
      [LOCALE_REGISTRATION_CONFIG_KIND, LOCALE_REGISTRATION_SCOPE],
    );
    if (rows.length === 0) return { revision: 0, codes: [SOURCE_LOCALE] };
    const codes = (rows[0].payload.locales ?? []).flatMap((entry) => (typeof entry.code === 'string' ? [entry.code] : []));
    return { revision: rows[0].revision, codes };
  }

  async saveDraft(input: {
    readonly kind: ContentKind;
    readonly key: string;
    readonly payload: Record<string, unknown>;
    readonly operatorId: string;
  }): Promise<ContentDraft> {
    const saved = await this.drafts.save({
      kind: input.kind,
      scope: input.key,
      payload: input.payload,
      actorId: input.operatorId,
    });
    return this.withAuthor(saved);
  }

  async submitDraft(item: ContentItemRef): Promise<ContentDraft | null> {
    try {
      return await this.withAuthor(await this.drafts.submit({ kind: item.kind, scope: item.key }));
    } catch (error) {
      if (error instanceof ConfigurationDraftMissingError) return null;
      throw error;
    }
  }

  async discardDraft(item: ContentItemRef): Promise<string | null> {
    const open = (await this.drafts.openOf({ kind: item.kind })).find((draft) => draft.scope === item.key);
    if (open === undefined) return null;
    return (await this.drafts.discard({ kind: item.kind, scope: item.key })) ? open.id : null;
  }

  async publishReviewed(input: {
    readonly items: readonly ContentItemRef[];
    readonly signOff: Readonly<Record<string, ContentSignOff>>;
    readonly operatorId: string;
  }): Promise<{ readonly publicationId: string }> {
    try {
      const set = await this.publisher.publishSet({
        entries: input.items.map((item) => ({ kind: item.kind, scope: item.key, fromReview: true as const })),
        actorId: input.operatorId,
        signOff: Object.fromEntries(
          Object.entries(input.signOff).map(([locale, signOff]) => [
            locale,
            { by: signOff.by, at: signOff.at.toISOString() },
          ]),
        ),
      });
      await this.configurationStore.poll();
      return { publicationId: set.publicationId };
    } catch (error) {
      if (error instanceof ConfigurationDraftMissingError) throw new ContentDraftMissingError();
      if (error instanceof ConfigurationPayloadRefusedError) throw new ContentPayloadRefusedError();
      throw error;
    }
  }

  async revert(item: ContentItemRef): Promise<{ readonly id: string; readonly revision: number } | null> {
    const rows = await this.dataSource.query<{ id: string; revision: number }[]>(
      `SELECT earlier.id, earlier.revision
         FROM config.entry_schedule s
         JOIN config.entry_version live ON live.id = s.version_id
         JOIN config.entry_version earlier
           ON earlier.kind = live.kind AND earlier.scope = live.scope
          AND earlier.state = 'superseded' AND earlier.revision < live.revision
        WHERE s.kind = $1 AND s.scope = $2 AND s.validity = '[,)'
        ORDER BY earlier.revision DESC LIMIT 1`,
      [item.kind, item.key],
    );
    if (rows.length === 0) return null;
    await this.publisher.revert({ kind: item.kind, scope: item.key, toRevision: rows[0].revision });
    await this.configurationStore.poll();
    return rows[0];
  }

  organizationCount(input: { readonly requesterId: string }): Promise<number> {
    return this.adminReadOnly.acquire(
      { requesterId: input.requesterId, purpose: ACQUISITION_PURPOSE.CONTENT_PUBLICATION, organizationId: null },
      async (runner) => {
        const [row] = (await runner.query(`SELECT count(*)::int AS organizations FROM core.organization`)) as {
          organizations: number;
        }[];
        return row.organizations;
      },
    );
  }

  async publishRegistration(input: {
    readonly codes: readonly string[];
    readonly expectedRevision: number;
    readonly operatorId: string;
  }): Promise<{ readonly id: string; readonly revision: number }> {
    try {
      const published = await this.publisher.publish({
        kind: LOCALE_REGISTRATION_CONFIG_KIND,
        scope: LOCALE_REGISTRATION_SCOPE,
        payload: { locales: input.codes.map((code) => ({ code, source: code === SOURCE_LOCALE })) },
        actorId: input.operatorId,
        expectedRevision: input.expectedRevision,
      });
      await this.configurationStore.poll();
      return published;
    } catch (error) {
      if (error instanceof ConfigurationRevisionMismatchError) throw new LocaleRegistrationChangedError();
      throw error;
    }
  }

  /** The draft's author by address — the drafts service answers an id, and the console names people. */
  private async withAuthor(draft: OpenDraft): Promise<ContentDraft> {
    const rows =
      draft.draftedBy === null
        ? []
        : await this.dataSource.query<{ email: string }[]>(`SELECT email FROM identity.admin_account WHERE id = $1`, [
            draft.draftedBy,
          ]);
    return {
      id: draft.id,
      revision: draft.revision,
      state: draft.state,
      payload: draft.payload,
      draftedAt: draft.draftedAt,
      draftedBy: rows[0]?.email ?? null,
    };
  }
}

interface ItemRow {
  kind: string;
  scope: string;
  live_revision: number | null;
  live_payload: Record<string, unknown> | null;
  live_published_at: Date | null;
  live_published_by: string | null;
  live_revertible: boolean;
  draft_id: string | null;
  draft_revision: number | null;
  draft_state: (typeof CONTENT_DRAFT_STATE)[keyof typeof CONTENT_DRAFT_STATE] | null;
  draft_payload: Record<string, unknown> | null;
  draft_at: Date | null;
  draft_by: string | null;
}

interface FallbackRow {
  content_key: string;
  locale: string;
  first_seen_at: Date;
  last_seen_at: Date;
  occurrences: number;
}

const isContentKind = (value: string): value is ContentKind => (KINDS as readonly string[]).includes(value);

const toItem = (row: ItemRow, kind: ContentKind): ContentItem => ({
  kind,
  key: row.scope,
  inForce:
    row.live_revision === null || row.live_payload === null || row.live_published_at === null
      ? null
      : {
          revision: row.live_revision,
          payload: row.live_payload,
          publishedAt: row.live_published_at,
          publishedBy: row.live_published_by,
          revertible: row.live_revertible,
        },
  draft:
    row.draft_id === null ||
    row.draft_revision === null ||
    row.draft_state === null ||
    row.draft_payload === null ||
    row.draft_at === null
      ? null
      : {
          id: row.draft_id,
          revision: row.draft_revision,
          state: row.draft_state,
          payload: row.draft_payload,
          draftedAt: row.draft_at,
          draftedBy: row.draft_by,
        },
});
