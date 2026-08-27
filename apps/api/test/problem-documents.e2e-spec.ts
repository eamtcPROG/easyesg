import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { findInternalIdentifiers, LOCALES } from '@easyesg/i18n';
import { AppModule } from '../src/app.module';
import { initialiseCatalogue } from '../src/app/messages/catalogue';
import { PROBLEM_BASE_URI, ProblemType } from '../src/app/filters/problem-types';
import { configureHttpApp } from '../src/main.http';

/**
 * **What an error body actually looks like when it leaves** (task 28.3; §6.8, NFR-79, NFR-90).
 *
 * **The division of labour is worth stating, because this file could be read as claiming more than
 * it does.** `message-content.spec.ts` is what establishes *"every error body passes the rule"*: it
 * checks the whole corpus, hermetically, in all three locales, and therefore covers every body that
 * can exist — including the ones no request here provokes. Verified by planting `(FR-12; see
 * identity.membership)` in a real message: the corpus gate failed, and this suite stayed green,
 * because that string is a 403 and the cases below raise 401, 400 and 404.
 *
 * What this file adds is the **envelope on the wire**, which no static check can see: the content
 * type, the `type` URI, the correlation id in the body agreeing with the header, the instance, and
 * the negotiated language. It re-runs the content rule on the prose it does receive, as a cheap
 * consistency check between the corpus and what `translate` actually renders — not as the proof.
 *
 * **All three of `ProblemDetailsFilter`'s paths are exercised, and none costs a sign-in**: a
 * `DomainError` raised by a guard (401), a framework `HttpException` from validation (400), and the
 * unmatched-route 404 that Nest raises on its own. The fourth path — an unknown exception becoming
 * a 500 — is deliberately left to `problem-details.filter.spec.ts`, because provoking one over HTTP
 * means breaking something real, and a test that has to sabotage the application to reach a branch
 * is testing the sabotage.
 *
 * The assertions are written as **invariants over any error body** rather than per route, so a new
 * refusal is covered by the shape rather than by somebody adding a case.
 */
describe('problem documents (§6.8, NFR-79, NFR-90)', () => {
  let app: NestExpressApplication;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await initialiseCatalogue();
    app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: false });
    configureHttpApp(app);
    await app.init();
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  interface Problem {
    type?: string;
    title?: string;
    status?: number;
    detail?: string;
    instance?: string;
    correlationId?: string;
  }

  /** The three filter paths, each reachable anonymously. */
  const CASES = [
    {
      name: 'a domain refusal raised by a guard',
      status: 401,
      call: () => http().get('/api/v1/memberships'),
    },
    {
      name: 'a framework validation failure',
      status: 400,
      call: () => http().post('/api/v1/auth/verify-email').send({}),
    },
    {
      name: 'an unmatched route',
      status: 404,
      call: () => http().get('/api/v1/no-such-route'),
    },
  ];

  describe.each(CASES)('$name', ({ status, call }) => {
    it(`answers application/problem+json with status ${status}`, async () => {
      const response = await call().expect(status);

      // Never the success envelope: §6.8 puts errors outside it, and a client that has to guess
      // which shape it received is a client that guesses wrong under load.
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect((response.body as Problem).status).toBe(status);
    });

    it('carries a machine-readable type URI, and no slug in the prose', async () => {
      const response = await call();
      const problem = response.body as Problem;

      expect(problem.type?.startsWith(`${PROBLEM_BASE_URI}/`)).toBe(true);

      // The identity lives in `type`, which is a URI meant for code. `title` and `detail` are for a
      // person, and CLAUDE.md names the problem-type slug among the identifiers forbidden there —
      // so `title: 'validation-failed'` would be a violation twice over.
      const slugs = Object.values(ProblemType);
      for (const prose of [problem.title, problem.detail].filter(Boolean) as string[]) {
        expect({ prose, offences: findInternalIdentifiers(prose, slugs) }).toEqual({
          prose,
          offences: [],
        });
      }
    });

    /**
     * NFR-90's identifier, on the one surface a person can quote it from. `CLAUDE.md` allows a
     * reference code in user-facing text precisely and only where somebody needs to cite it back,
     * and names this as the case.
     */
    it('carries the correlation id, and the response header agrees with the body', async () => {
      const response = await call();
      const problem = response.body as Problem;

      expect(problem.correlationId).toBeDefined();
      expect(response.headers['x-correlation-id']).toBe(problem.correlationId);
    });

    it('names the instance that failed', async () => {
      const response = await call();
      expect((response.body as Problem).instance).toContain('/api/v1/');
    });
  });

  /**
   * **One identifier, not two** — the middleware's stated design, asserted rather than trusted.
   *
   * The id is *derived* from an inbound W3C `traceparent` trace-id where one is present, so an
   * OpenTelemetry span and the business rows carrying `correlation_id` join directly. Minting a
   * second value beside the trace would make that join need a mapping table nobody builds, and the
   * failure would only show up the first time somebody tried to answer "I paid and nothing
   * happened" across five stages.
   */
  it('derives the correlation id from an inbound traceparent (NFR-90)', async () => {
    const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
    const response = await http()
      .get('/api/v1/memberships')
      .set('traceparent', `00-${traceId}-00f067aa0ba902b7-01`)
      .expect(401);

    expect((response.body as Problem).correlationId).toBe(traceId);
    expect(response.headers['x-correlation-id']).toBe(traceId);
  });

  it('mints one when the traceparent is absent or malformed', async () => {
    const response = await http()
      .get('/api/v1/memberships')
      .set('traceparent', 'not-a-traceparent')
      .expect(401);

    // A malformed header is not a reason to answer without an id: the caller still needs something
    // to quote, and the operator still needs something to search.
    expect((response.body as Problem).correlationId).toMatch(/^[0-9a-f-]{36}$/u);
  });

  /**
   * The prose is served in the negotiated language (OQ-46), which is what makes the no-identifiers
   * rule meaningful in all three: a rule that only held for the locale a developer reads would be
   * a rule about English.
   */
  it.each(LOCALES)('answers %s prose when that locale is asked for', async (locale) => {
    const response = await http()
      .get('/api/v1/memberships')
      .set('accept-language', locale)
      .expect(401);

    expect(response.headers['content-language']).toBe(locale);
    const problem = response.body as Problem;
    expect(problem.detail).toBeDefined();
    expect(findInternalIdentifiers(problem.detail ?? '', Object.values(ProblemType))).toEqual([]);
  });
});
