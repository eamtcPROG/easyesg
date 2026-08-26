import 'server-only';
import {
  readProblemDocument,
  readResultList,
  readResultObject,
} from '@easyesg/contracts';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { API_OUTCOME, type ApiFailure, type ApiOutcome, type ListResult } from '@/lib/api-outcome';
import { buildListQuery, type ListQuery } from '@/lib/pagination';
import { REFRESH_COOKIE } from '@/lib/session-cookie';
import { env } from '@/lib/env';
import { unsealSession } from './session-codec';

/**
 * The typed client for the public API. **The only place that knows the wire conventions — and
 * the only place that assembles ambient request context** (post-close review, 20 Aug 2026:
 * iftamaster's `GeneralAxiosRepository` is the reference shape — its call sites never attach a
 * token or a timezone header themselves, the seam does). Here the ambient context is the
 * active locale: `getLocale()` is resolved HERE and rides `Accept-Language` on every call, so
 * problem text and envelope messages arrive resolved in the language the user is reading —
 * and no action repeats the resolution. Since task 22 the access token is the second piece:
 * read from the sealed session cookie (never rotated here — see `sessionAuthorization`) and
 * attached as the `Authorization` bearer whenever a session exists.
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

/**
 * Whether a call may assemble ambient request context — the active locale and the session's
 * bearer token.
 *
 * The seam's rule is that context is assembled here and never at call sites, and `Detached` does
 * not weaken it: it names the one caller for which the context does not exist. `proxy.ts` runs
 * before Next establishes a request scope, so `cookies()` and `getLocale()` have nothing to read
 * there — and the single call it makes, the refresh exchange, wants neither. It authenticates by
 * the token in its own body (task 21: possession is the proof, and it works after the access token
 * has expired), and its answer is read by machinery rather than rendered to a person, so no
 * `Accept-Language` changes what happens.
 *
 * Anything else reaching for `Detached` is a call that has quietly dropped the caller's language
 * and identity, which is exactly the drift the seam exists to prevent.
 */
const REQUEST_CONTEXT = {
  Ambient: 'ambient',
  Detached: 'detached',
} as const;

type RequestContext = (typeof REQUEST_CONTEXT)[keyof typeof REQUEST_CONTEXT];

/**
 * The body READERS live in `@easyesg/contracts` since task 23 (`outcome.ts` there carries the
 * validate-never-cast argument in full) — this seam keeps what is its own: turning a reader's
 * throw into `unreachable`, and logging the reason for a developer without the body (NFR-30).
 */
/**
 * Parses a JSON body, turning any failure — malformed JSON, or a body that is not the envelope
 * this tier expects — into `unreachable`. The reason is logged for a developer, without the body.
 */
async function readBody<T>(
  response: Response,
  path: string,
  read: (body: unknown) => T,
): Promise<T | null> {
  try {
    return read(await response.json());
  } catch (error) {
    console.error(`api-client: unusable response body`, {
      path,
      status: response.status,
      reason: error instanceof Error ? error.message : 'unparseable JSON',
    });
    return null;
  }
}

/**
 * The second piece of ambient context, joining the locale as task 20's docblock said it would:
 * the access token from the sealed session cookie (task 22, OQ-33). Read-only on purpose —
 * this seam serves Server Components, where cookie writes throw, so it must never rotate;
 * `session.ts` owns rotation and the callers that may. Attached whenever a session exists,
 * expiry included: the API is the authority on token liveness, and withholding a token this
 * tier merely *believes* expired would turn clock skew into a 401 the API never issued.
 */
async function sessionAuthorization(): Promise<Record<string, string>> {
  const sealed = (await cookies()).get(REFRESH_COOKIE)?.value;
  const session = sealed ? unsealSession(sealed, env.sessionSecret) : null;
  return session ? { authorization: `Bearer ${session.accessToken}` } : {};
}

/** Everything up to reading a success body: fetch, ambient context, problem/unreachable. */
async function send(
  method: Method,
  path: string,
  body?: unknown,
  context: RequestContext = REQUEST_CONTEXT.Ambient,
): Promise<{ response: Response } | ApiFailure> {
  const ambient = context === REQUEST_CONTEXT.Ambient;
  const locale = ambient ? await getLocale() : null;
  const authorization = ambient ? await sessionAuthorization() : {};

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        ...(locale ? { 'accept-language': locale } : {}),
        ...authorization,
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
    const problem = await readBody(response, path, (body) =>
      readProblemDocument(body, response.status),
    );
    // Only unparseable JSON reaches null here — `readProblemDocument` repairs everything else.
    return problem
      ? { status: API_OUTCOME.Problem, problem }
      : { status: API_OUTCOME.Unreachable };
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
  context?: RequestContext,
): Promise<ApiOutcome<TObject>> {
  const sent = await send(method, path, body, context);
  if (!('response' in sent)) return sent;

  // 202/204 leave with no body by design (§6.8's bypasses).
  if (sent.response.status === 202 || sent.response.status === 204) {
    return { status: API_OUTCOME.Ok, value: undefined as TObject, messages: [] };
  }

  const envelope = await readBody(sent.response, path, (body) =>
    readResultObject<TObject>(body, path),
  );
  if (!envelope) return { status: API_OUTCOME.Unreachable };

  return { status: API_OUTCOME.Ok, value: envelope.object, messages: envelope.messages };
}

async function requestList<TObject>(
  path: string,
  query?: ListQuery,
): Promise<ApiOutcome<ListResult<TObject>>> {
  const search = buildListQuery(query);
  const sent = await send(METHOD.Get, search ? `${path}?${search}` : path);
  if (!('response' in sent)) return sent;

  const envelope = await readBody(sent.response, path, (body) =>
    readResultList<TObject>(body, path),
  );
  if (!envelope) return { status: API_OUTCOME.Unreachable };

  const { messages, ...value } = envelope;
  return { status: API_OUTCOME.Ok, value, messages };
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

  /**
   * `delete` returns `undefined` by default because the API's deletes answer 204 — and it
   * accepts a body because `DELETE /auth/session` authenticates by the refresh token it
   * carries (task 21: possession is the proof, and it works after the access token expired).
   */
  delete: <TBody = undefined, TObject = undefined>(
    path: string,
    body?: TBody,
  ): Promise<ApiOutcome<TObject>> => requestObject<TObject>(METHOD.Delete, path, body),
} as const;

/**
 * The same client with the ambient context withheld — see `REQUEST_CONTEXT`.
 *
 * One caller, and it is named rather than general on purpose: `proxy.ts`'s page-load rotation
 * (architecture.md §12.5.6, task 26.4). `post` is the only verb because refresh is the only call
 * that can honestly be made this way; a `get` here would be a read whose tenant nobody bound.
 */
export const detachedApi = {
  post: <TBody, TObject>(path: string, body: TBody): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Post, path, body, REQUEST_CONTEXT.Detached),
} as const;
