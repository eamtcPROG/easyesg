import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { runInRequestContext } from '@api/infrastructure/persistence/request-context';
import { DomainError } from './domain.error';
import { ProblemDetailsFilter } from './problem-details.filter';
import { ProblemType, ProblemTypeSlug, PROBLEM_BASE_URI } from './problem-types';

/**
 * The guarantee under test is **negative**, and that is deliberate.
 *
 * The catalogues ship empty, so nothing resolves yet. What must hold regardless of whether copy
 * has been written is that the filter never falls back to something readable-looking: CLAUDE.md
 * forbids a problem-type slug, an enum member or a provider error string from reaching `title`
 * or `detail`, and the previous implementation put the slug in `title` on every single response.
 *
 * A test that only checked resolution would pass the day copy lands and say nothing about the
 * months before it.
 */

class QuotaExceededError extends DomainError {
  readonly problemType: ProblemTypeSlug = ProblemType.EntitlementQuotaExceeded;
  readonly status = HttpStatus.FORBIDDEN;

  constructor() {
    super('problem.entitlement-quota-exceeded.detail', { limit: 3 }, { limit: 3 });
  }
}

async function capture(
  exception: unknown,
  locale: 'ro' | 'en' | 'ru' = 'ro',
): Promise<Record<string, unknown>> {
  const filter = new ProblemDetailsFilter();
  let body: Record<string, unknown> = {};

  const res = {
    status: () => res,
    type: () => res,
    json: (payload: Record<string, unknown>) => {
      body = payload;
      return res;
    },
  } as unknown as Response;

  const req = { originalUrl: '/v1/reports', correlationId: 'c-1' } as unknown as Request;
  const host = {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }),
  } as unknown as ArgumentsHost;

  // Awaited inside the context: `catch` is async, and returning before it resolves would leave
  // `body` empty — a green test that asserts nothing.
  await runInRequestContext({ correlationId: 'c-1', locale }, () => filter.catch(exception, host));

  return body;
}

const LEAKS = [
  ...Object.values(ProblemType),
  'Unauthorized',
  'Not Found',
  'Internal Server Error',
];

function assertNoIdentifierLeak(body: Record<string, unknown>): void {
  for (const member of ['title', 'detail'] as const) {
    const value = body[member];
    if (value === undefined) continue;
    expect(typeof value).toBe('string');
    for (const leak of LEAKS) {
      expect(value).not.toContain(leak);
    }
  }
}

describe('ProblemDetailsFilter', () => {
  it('never puts the problem-type slug in title or detail for a domain error', async () => {
    const body = await capture(new QuotaExceededError());

    expect(body.type).toBe(`${PROBLEM_BASE_URI}/${ProblemType.EntitlementQuotaExceeded}`);
    expect(body.status).toBe(HttpStatus.FORBIDDEN);
    assertNoIdentifierLeak(body);
  });

  it('omits title rather than inventing one when the catalogue has no entry', async () => {
    // RFC 9457 makes every member optional, so an absent title is a valid document. A title
    // holding the slug is not — it is an internal identifier where a human-readable summary
    // belongs, and it tells an SME owner nothing about what to do next (NFR-79).
    const body = await capture(new QuotaExceededError());
    expect('title' in body ? body.title : undefined).toBeUndefined();
  });

  it('does not reflect the framework default message', async () => {
    // Nest's own "Unauthorized" is an English string nobody here wrote, and the JSXText lint
    // rule cannot see it because it lives in node_modules — the same class as a router's
    // built-in Not Found page.
    const body = await capture(new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED));

    expect(body.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(body.type).toBe(`${PROBLEM_BASE_URI}/${ProblemType.AuthenticationRequired}`);
    assertNoIdentifierLeak(body);
  });

  it('never reflects an unexpected error message, which could carry SQL or topology', async () => {
    // NFR-30. A raw driver error is how the shape of a system gets handed to whoever is probing.
    const body = await capture(new Error('select * from billing.invoice where tenant = $1'));

    expect(body.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(body)).not.toContain('billing.invoice');
    assertNoIdentifierLeak(body);
  });

  it('keeps the correlation id, which is the one reference a user may quote', async () => {
    // CLAUDE.md permits a reference code shown on purpose; NFR-90 makes this the id that joins
    // order to payment to invoice to ledger.
    expect((await capture(new QuotaExceededError())).correlationId).toBe('c-1');
  });

  it('preserves domain extension members', async () => {
    expect((await capture(new QuotaExceededError())).limit).toBe(3);
  });

  it.each(['ro', 'en', 'ru'] as const)('produces a valid document in %s', async (locale) => {
    const body = await capture(new QuotaExceededError(), locale);
    expect(body.type).toBeDefined();
    expect(body.status).toBe(HttpStatus.FORBIDDEN);
    assertNoIdentifierLeak(body);
  });
});
