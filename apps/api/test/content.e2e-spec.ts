import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { ProblemType, problemTypeUri } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';
import { ConfigurationPayloadRefusedError } from '../src/infrastructure/configuration/configuration-payload-refused.error';
import { ConfigurationPublisher } from '../src/infrastructure/configuration/configuration-publisher.service';
import { ConfigurationStore } from '../src/infrastructure/configuration/configuration-store.service';
import { CONTENT_KIND } from '../src/modules/platform/content/constants/content.constants';
import { ContentTranslationWatch } from '../src/modules/platform/content/services/content-translation-watch.service';
import { ContentFallbackQueue } from '../src/modules/platform/localization/services/content-fallback-queue.service';
import { connectAs } from './support/database';
import { restoreSlot, snapshotSlot, type SlotSnapshot } from './support/configuration-slot';

/**
 * FR-61's published content over real HTTP, read with no session (task 76; UC-180, UC-181, FR-64; `architecture.md`
 * §12.5.6's task-76 row) — the three locales, what has no address, the store refusing what the read would leave out,
 * and a fallback reaching FR-64's queue once per key and locale and leaving it when its translation is published.
 *
 * **What it needs and does not create**: the starter help library, which `pretest:e2e`'s `config:seed` publishes from
 * `config/seed/help-*.json`. **What it leaves**: the article it edits restored under its own publisher (task 172), and a
 * plan copy under the suite's own code, `e2e-plan` — the store cannot un-publish a slot and no plan copy is seeded, so
 * that one stays in force in the test stack, re-published identically by every run.
 */
const ARTICLE = 'what-the-report-asks';
const PLAN = 'e2e-plan';

const SEEDED_ARTICLE = JSON.parse(
  readFileSync(resolve(__dirname, `../../../config/seed/help-article.${ARTICLE}.json`), 'utf8'),
) as { locales: Record<string, unknown> } & Record<string, unknown>;

const planCopy = (name: string) => ({ name, summary: `${name}, pe scurt.`, highlights: ['Un raport'] });

/** The suite's own plan copy, published whole by every run so what it leaves in force never varies. */
const PLAN_COPY = {
  order: 99,
  locales: { ro: planCopy('Plan de probă'), en: planCopy('Trial plan'), ru: planCopy('Пробный план') },
};

describe('the published content read (FR-61, FR-64; task 76)', () => {
  let app: NestExpressApplication;
  let application: DataSource;
  let articleSlot: SlotSnapshot | undefined;

  const http = () => request(app.getHttpServer());
  const object = <T>(response: request.Response) => (response.body as { object: T }).object;
  const objects = <T>(response: request.Response) => (response.body as { objects: T[] }).objects;

  const publish = async (kind: string, scope: string, payload: Record<string, unknown>) => {
    await app.get(ConfigurationPublisher).publish({ kind, scope, payload });
    await app.get(ConfigurationStore).refreshIfStale();
  };

  const queueRows = () =>
    application.query<{ locale: string; occurrences: string; ordered: boolean }[]>(
      `SELECT locale, occurrences::text AS occurrences, first_seen_at <= last_seen_at AS ordered
         FROM config.content_fallback WHERE content_key = $1 ORDER BY locale`,
      [`${CONTENT_KIND.HELP_ARTICLE}/${ARTICLE}`],
    );

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
    articleSlot = await snapshotSlot(app, { kind: CONTENT_KIND.HELP_ARTICLE, scope: ARTICLE });
    application = await connectAs('DB_USER', 'DB_PASSWORD', 'easyesg-content-app');
    await publish(CONTENT_KIND.PLAN_COPY, PLAN, PLAN_COPY);
  }, 60_000);

  afterAll(async () => {
    if (app !== undefined && articleSlot !== undefined) await restoreSlot(app, articleSlot, SEEDED_ARTICLE);
    await app?.close();
    await application?.destroy();
  });

  it.each(['ro', 'en', 'ru'])('serves the topics and an article in %s to a reader with no session', async (locale) => {
    const topics = objects<{ key: string; locale: string }>(
      await http().get(`/api/v1/content/help/topics?locale=${locale}`).expect(200),
    );
    expect(topics.find((topic) => topic.key === 'first-report')).toMatchObject({ locale });

    const article = object<{ locale: string; topic: string; sections: unknown[]; related: { key: string }[] }>(
      await http().get(`/api/v1/content/help/articles/${ARTICLE}?locale=${locale}`).expect(200),
    );
    expect(article).toMatchObject({ locale, topic: 'first-report' });
    expect(article.sections.length).toBeGreaterThan(0);
    expect(article.related.map((link) => link.key)).toEqual(['why-a-question-appears', 'electricity-and-fuel']);
  });

  it.each(['ro', 'en', 'ru'])('serves a plan’s copy in %s, and no price', async (locale) => {
    const copy = objects<Record<string, unknown>>(await http().get(`/api/v1/content/plans?locale=${locale}`).expect(200)).find(
      (entry) => entry.plan === PLAN,
    );
    expect(copy).toMatchObject({ locale, highlights: ['Un raport'], badge: null });
    expect(Object.keys(copy ?? {}).sort()).toEqual(['badge', 'highlights', 'locale', 'name', 'plan', 'summary']);
  });

  it('gives a version that is not in force no address — a draft stays unreachable when the cache is rebuilt', async () => {
    const scope = 'e2e-draft-only';
    const [{ next }] = await application.query<{ next: number }[]>(
      `SELECT coalesce(max(revision), 0) + 1 AS next FROM config.entry_version WHERE kind = $1 AND scope = $2`,
      [CONTENT_KIND.HELP_ARTICLE, scope],
    );
    await application.query(
      `INSERT INTO config.entry_version (kind, scope, revision, state, payload) VALUES ($1, $2, $3, 'draft', $4::jsonb)`,
      [CONTENT_KIND.HELP_ARTICLE, scope, next, JSON.stringify(SEEDED_ARTICLE)],
    );
    // Any publication moves the store's version, so the cache below is rebuilt with the draft in the table.
    await publish(CONTENT_KIND.PLAN_COPY, PLAN, PLAN_COPY);

    const refused = await http().get(`/api/v1/content/help/articles/${scope}?locale=ro`).expect(404);
    expect((refused.body as { type: string }).type).toBe(problemTypeUri(ProblemType.NotFound));
    const library = objects<{ key: string }>(await http().get('/api/v1/content/help/articles?locale=ro').expect(200));
    expect(library.map((entry) => entry.key)).not.toContain(scope);
  });

  it('refuses a language the platform does not publish in, and none', async () => {
    await http().get('/api/v1/content/help/topics?locale=de').expect(400);
    await http().get('/api/v1/content/plans').expect(400);
  });

  it('refuses to publish an item the read would leave out — no Romanian, the source', async () => {
    const { ro: _ro, ...translations } = SEEDED_ARTICLE.locales;
    await expect(
      app.get(ConfigurationPublisher).publish({
        kind: CONTENT_KIND.HELP_ARTICLE,
        scope: 'e2e-refused',
        payload: { ...SEEDED_ARTICLE, locales: translations },
      }),
    ).rejects.toThrow(ConfigurationPayloadRefusedError);
  });

  it('serves Romanian where a translation is missing, files the gap once per locale with a count, and lets it go once the translation is published', async () => {
    await application.query(`DELETE FROM config.content_fallback WHERE content_key = $1`, [
      `${CONTENT_KIND.HELP_ARTICLE}/${ARTICLE}`,
    ]);
    await publish(CONTENT_KIND.HELP_ARTICLE, ARTICLE, { ...SEEDED_ARTICLE, locales: { ro: SEEDED_ARTICLE.locales.ro } });

    for (let read = 0; read < 2; read += 1) {
      const served = object<{ locale: string }>(
        await http().get(`/api/v1/content/help/articles/${ARTICLE}?locale=en`).expect(200),
      );
      expect(served.locale).toBe('ro');
    }
    await http().get('/api/v1/content/help/articles?locale=ru').expect(200);
    await app.get(ContentFallbackQueue).write();

    expect(await queueRows()).toEqual([
      { locale: 'en', occurrences: '2', ordered: true },
      { locale: 'ru', occurrences: '1', ordered: true },
    ]);

    await publish(CONTENT_KIND.HELP_ARTICLE, ARTICLE, SEEDED_ARTICLE);
    await app.get(ContentTranslationWatch).settleIfMoved();
    expect(await queueRows()).toEqual([]);
  });
});
