import 'server-only';
import type { Message, ProblemDocument } from '@easyesg/contracts';
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

/**
 * Reading a body **validates it rather than asserting over it** — the same rule
 * `VerificationEmailHandler.readEvent` follows on the worker, and for the same reason.
 *
 * The API is ours and its shape is contract-tested (P-5), so a malformed body means something is
 * genuinely wrong rather than merely unexpected: a rolling deploy answering mid-request from two
 * versions, a proxy interposing its own JSON, a route that stopped using the envelope. A blind
 * `as` cast reads `envelope.object` as `undefined` and hands that to a screen, which renders it
 * as *empty* — a silent wrong answer, and the exact failure shape this codebase keeps naming.
 *
 * These throw; `requestObject`/`requestList` catch and answer `unreachable`, because a body this
 * tier cannot understand is, to the person reading the screen, the same fact as no answer at all,
 * with the same remedy — and `unreachable` already carries NFR-79's three parts in the bundled
 * catalogue. Inventing a fourth outcome would mean authoring new copy in three locales for a case
 * that should never occur. The thrown message is developer-facing and stays untranslated, like
 * `DomainError`'s key; it names the shape and **never the body**, which may hold personal data
 * (NFR-30).
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Each reader returns exactly the members it checked, built explicitly rather than cast wholesale
 * — `body as ResultObject<T>` would claim `htmlcode` too, which nothing here validates or reads,
 * and TypeScript is right to refuse that. The one remaining assertion is on the generic payload
 * (`TObject`), whose shape is the route's contract rather than this function's business: the
 * envelope is the wire convention, and that is all this tier owns.
 */
function readResultObject<TObject>(
  body: unknown,
  path: string,
): { object: TObject; messages: Message[] } {
  if (!isRecord(body) || !('object' in body) || !Array.isArray(body.messages)) {
    // `object` must be PRESENT, not truthy: `ResultObjectDto.object` is nullable, and a route
    // that legitimately answers null must not be mistaken for a malformed envelope.
    throw new Error(`${path}: response is not a result envelope (expected object, messages[]).`);
  }
  return { object: body.object as TObject, messages: body.messages as Message[] };
}

function readResultList<TObject>(
  body: unknown,
  path: string,
): ListResult<TObject> & { messages: Message[] } {
  if (
    !isRecord(body) ||
    !Array.isArray(body.objects) ||
    typeof body.total !== 'number' ||
    typeof body.totalpages !== 'number' ||
    !Array.isArray(body.messages)
  ) {
    // `total` and `totalpages` are checked because they are READ — they drive the pager, and a
    // NaN there renders as garbage rather than failing.
    throw new Error(
      `${path}: response is not a list envelope (expected objects[], total, totalpages, messages[]).`,
    );
  }
  return {
    items: body.objects as TObject[],
    total: body.total,
    totalpages: body.totalpages,
    messages: body.messages as Message[],
  };
}

/**
 * A problem document is repaired rather than rejected where it can be, because a failure that
 * arrives slightly malformed is still a failure the user must be told about — dropping it to
 * `unreachable` would replace "the address is already taken" with "try again later".
 *
 * RFC 9457 makes every member optional, so absence is valid rather than broken: `type` falls back
 * to the standard's own `about:blank`, `status` to the HTTP status (which is authoritative anyway),
 * and `title`/`detail` are simply omitted — the screens already fall back to catalogue copy when
 * they are, per the API's own "a missing key omits the member" rule.
 */
function readProblemDocument(body: unknown, httpStatus: number): ProblemDocument {
  const source = isRecord(body) ? body : {};
  const text = (value: unknown): string | undefined =>
    typeof value === 'string' ? value : undefined;

  return {
    type: text(source.type) ?? 'about:blank',
    status: typeof source.status === 'number' ? source.status : httpStatus,
    title: text(source.title),
    detail: text(source.detail),
    instance: text(source.instance),
    correlationId: text(source.correlationId),
  };
}

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
): Promise<ApiOutcome<TObject>> {
  const sent = await send(method, path, body);
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

  delete: <TObject = undefined>(path: string): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Delete, path),
} as const;
