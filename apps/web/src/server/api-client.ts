import 'server-only';
import type { ProblemDocument, ResultList, ResultObject } from '@easyesg/contracts';
import { getLocale } from 'next-intl/server';
import { API_OUTCOME, type ApiFailure, type ApiOutcome, type ListResult } from '@/lib/api-outcome';
import { buildListQuery, type ListQuery } from '@/lib/pagination';
import { env } from '@/lib/env';

/**
 * The typed client for the public API. **The only place that knows the wire conventions — and
 * the only place that assembles ambient request context** (post-close review, 20 Aug 2026:
 * iftamaster's `GeneralAxiosRepository` is the reference shape — its call sites never attach a
 * token or a timezone header themselves, the seam does). Here the ambient context is the
 * active locale: `getLocale()` is resolved HERE and rides `Accept-Language` on every call, so
 * problem text and envelope messages arrive resolved in the language the user is reading —
 * and no action repeats the resolution. Task 22's access token joins the same place.
 *
 * Three response shapes have to be told apart, and getting this wrong once means getting it
 * wrong everywhere — which is why it is written here and nowhere else (§6.8):
 *
 * 1. **Success is enveloped.** A global interceptor wraps every success in `ResultObjectDto<T>`
 *    (`htmlcode`, `object`, `messages`) or `ResultListDto<T>` (`htmlcode`, `objects`, `total`,
 *    `totalpages`, `messages`). There is no `error: boolean` field — failures never travel
 *    this way. `messages[]` is surfaced on the Ok outcome: `WARNING` is how AD-5's
 *    `allow_with_warning` reaches a caller, and a client that dropped it would swallow that
 *    surface silently.
 * 2. **Errors are not enveloped.** They leave as RFC 9457 `application/problem+json`, with
 *    `title`/`detail` already resolved in the request's negotiated locale (OQ-46) and in
 *    NFR-79's three-part shape — so a screen renders them as received and never maps a slug to
 *    a sentence.
 * 3. **Bypasses**: an explicit 202/204 with no body (`value` is `undefined`), and
 *    `StreamableFile`/`Buffer` byte streams — those are downloads, they must pass through the
 *    `/api/[...path]` proxy byte-for-byte (FR-53), and they are deliberately NOT this client's
 *    job.
 *
 * Every outcome leaves as one `ApiOutcome<T>` (`@/lib/api-outcome`), which travels unchanged
 * through a Server Action to the component — the action only projects the value with
 * `mapOutcome`. A list call's value is `ListResult<T>`, so lists ride the same container. The
 * `unreachable` member exists because the screens must render NFR-79's three-part explanation
 * from the *bundled* catalogue when the API is down (OQ-43) — it also absorbs the timeout and
 * any non-problem gateway failure, which to the user are the same fact with the same remedy.
 *
 * Types come from `@easyesg/contracts`, generated from `apps/api`'s OpenAPI and diffed in CI
 * (P-5). `apps/api` produces that package and must never import it; this app consumes it.
 * List queries are built by `@/lib/pagination`, the typed inverse of the API's
 * `ListQueryInterceptor`.
 *
 * `API_BASE_URL` carries the `/api/v1` prefix (the committed `.env.example` convention), so
 * `path` here is version-relative: `/auth/register`, never `/api/v1/auth/register`.
 */
const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/**
 * A stuck upstream must fail the Server Action, not hang it: the interactive budgets are
 * sub-second (§8.5), so ten seconds is already the far side of wrong, and the abort surfaces
 * as `unreachable` — the outcome whose catalogue text tells the user to try again.
 */
const REQUEST_TIMEOUT_MS = 10_000;

const METHOD = {
  Get: 'GET',
  Post: 'POST',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;

type Method = (typeof METHOD)[keyof typeof METHOD];

/** Everything up to reading a success body: fetch, ambient context, problem/unreachable. */
async function send(
  method: Method,
  path: string,
  body?: unknown,
): Promise<{ response: Response } | ApiFailure> {
  const locale = await getLocale();

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        'accept-language': locale,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return { status: API_OUTCOME.Unreachable };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes(PROBLEM_MEDIA_TYPE)) {
    const problem = (await response.json()) as ProblemDocument;
    return { status: API_OUTCOME.Problem, problem };
  }

  if (!response.ok) {
    // A non-problem failure means something other than the API answered (an edge 502, a
    // half-started stack). To the user that is indistinguishable from unreachable, and the
    // remedy — try again — is the same.
    return { status: API_OUTCOME.Unreachable };
  }

  return { response };
}

async function requestObject<TObject>(
  method: Method,
  path: string,
  body?: unknown,
): Promise<ApiOutcome<TObject>> {
  const sent = await send(method, path, body);
  if (!('response' in sent)) return sent;

  // 202/204 leave with no body by design (§6.8's bypasses).
  if (sent.response.status === 202 || sent.response.status === 204) {
    return { status: API_OUTCOME.Ok, value: undefined as TObject, messages: [] };
  }

  const envelope = (await sent.response.json()) as ResultObject<TObject>;
  return { status: API_OUTCOME.Ok, value: envelope.object, messages: envelope.messages };
}

async function requestList<TObject>(
  path: string,
  query?: ListQuery,
): Promise<ApiOutcome<ListResult<TObject>>> {
  const search = buildListQuery(query);
  const sent = await send(METHOD.Get, search ? `${path}?${search}` : path);
  if (!('response' in sent)) return sent;

  const envelope = (await sent.response.json()) as ResultList<TObject>;
  return {
    status: API_OUTCOME.Ok,
    value: {
      items: envelope.objects,
      total: envelope.total,
      totalpages: envelope.totalpages,
    },
    messages: envelope.messages,
  };
}

/**
 * The verb surface. One method per §6.8 shape a route can take; a new consumer picks a verb
 * and a projection, and nothing else. `delete` returns `undefined` by default because the
 * API's deletes answer 204.
 */
export const api = {
  get: <TObject>(path: string): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Get, path),

  getList: <TObject>(path: string, query?: ListQuery): Promise<ApiOutcome<ListResult<TObject>>> =>
    requestList<TObject>(path, query),

  post: <TBody, TObject>(path: string, body: TBody): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Post, path, body),

  patch: <TBody, TObject>(path: string, body: TBody): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Patch, path, body),

  delete: <TObject = undefined>(path: string): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Delete, path),
} as const;
