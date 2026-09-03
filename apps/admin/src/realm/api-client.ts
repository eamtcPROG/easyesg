import {
  API_OUTCOME,
  readProblemDocument,
  readResultObject,
  type ApiFailure,
  type ApiOutcome,
  type ListResult,
} from '@easyesg/contracts';
import { CONSOLE_LOCALE } from '~/i18n';
import { env } from '~/lib/env';

/**
 * The console's client for the one public API (DR-11, P-5) — `apps/web`'s seam shape, in the
 * browser: one place that knows the wire conventions and assembles ambient context. The §6.8
 * envelope/problem/unreachable discipline itself lives in `@easyesg/contracts` (`outcome.ts`,
 * shared with the web tier since task 23); what THIS seam owns is transport and context:
 *
 *  - **`credentials: 'include'`** — the session is the sealed httpOnly cookie the api itself
 *    set (OQ-17), and requests are cross-origin by design (`admin.<host>` → `api.<host>`,
 *    NFR-65's separate cookie scope; vite.config.ts declines a dev proxy so this is exercised
 *    from the first request). The api's CORS allows exactly the console origin, with
 *    credentials (§12.5.6's task-23 rows). No Authorization header exists here — browser
 *    JavaScript never holds a token, which is the whole design.
 *  - **`Accept-Language: ro`** — the console is Romanian-only (OQ-42) and OQ-46 makes the
 *    clients responsible for saying so; problem text arrives resolved.
 *
 * A reader's throw becomes `unreachable` exactly as on the web seam, and the logged reason
 * names the shape, never the body (NFR-30).
 */
const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/** Sub-second interactive budgets (§8.5); ten seconds is already the far side of wrong. */
const REQUEST_TIMEOUT_MS = 10_000;

const METHOD = {
  Get: 'GET',
  Post: 'POST',
  Patch: 'PATCH',
  Delete: 'DELETE',
} as const;

type Method = (typeof METHOD)[keyof typeof METHOD];

async function readBody<T>(
  response: Response,
  path: string,
  read: (body: unknown) => T,
): Promise<T | null> {
  try {
    return read(await response.json());
  } catch (error) {
    console.error(`admin api-client: unusable response body`, {
      path,
      status: response.status,
      reason: error instanceof Error ? error.message : 'unparseable JSON',
    });
    return null;
  }
}

async function send(
  method: Method,
  path: string,
  body?: unknown,
): Promise<{ response: Response } | ApiFailure> {
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method,
      headers: {
        'accept-language': CONSOLE_LOCALE,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'include',
      cache: 'no-store',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // The tenant seam's rule, applied where it holds (3 Sep 2026): a request that never completed
    // is the failure an operator must be able to see, and a bare `catch` discarded it. The class,
    // never the request — an admin sign-in body carries a password and a code.
    console.error('admin api-client: request did not complete', {
      path,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return { status: API_OUTCOME.Unreachable };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes(PROBLEM_MEDIA_TYPE)) {
    const problem = await readBody(response, path, (parsed) =>
      readProblemDocument(parsed, response.status),
    );
    return problem
      ? { status: API_OUTCOME.Problem, problem }
      : { status: API_OUTCOME.Unreachable };
  }

  if (!response.ok) {
    // Something other than the api answered. Identical to the tenant seam's case, and silent here
    // for the same reason it was silent there: the status is the only thing that says which hop.
    console.error('admin api-client: non-problem failure from upstream', { path, status: response.status });
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

  if (sent.response.status === 202 || sent.response.status === 204) {
    return { status: API_OUTCOME.Ok, value: undefined as TObject, messages: [] };
  }

  const envelope = await readBody(sent.response, path, (parsed) =>
    readResultObject<TObject>(parsed, path),
  );
  if (!envelope) return { status: API_OUTCOME.Unreachable };

  return { status: API_OUTCOME.Ok, value: envelope.object, messages: envelope.messages };
}

/**
 * The verb surface, mirroring the web seam. List calls arrive with the first Index screen
 * (task 67) — declared then, not speculatively now; `ListResult` is already imported by the
 * envelope reader the moment they do.
 */
export const api = {
  get: <TObject>(path: string): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Get, path),

  post: <TBody, TObject>(path: string, body: TBody): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Post, path, body),

  patch: <TBody, TObject>(path: string, body: TBody): Promise<ApiOutcome<TObject>> =>
    requestObject<TObject>(METHOD.Patch, path, body),

  delete: <TBody = undefined, TObject = undefined>(
    path: string,
    body?: TBody,
  ): Promise<ApiOutcome<TObject>> => requestObject<TObject>(METHOD.Delete, path, body),
} as const;

export type { ApiFailure, ApiOutcome, ListResult };
