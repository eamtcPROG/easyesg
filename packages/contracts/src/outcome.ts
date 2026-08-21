import type { Message } from './envelope';
import type { ProblemDocument } from './problem';

/**
 * The outcome of one API call, and the validated readers that produce it — shared by both
 * front ends since task 23 (extracted from `apps/web`, where task 20 wrote and task 22 proved
 * them, the moment `apps/admin` became the second consumer: two copies of subtle validation
 * logic is drift on the exact seam the wire contract exists to hold still).
 *
 * What lives here is deliberately PURE: the discriminated container, the projection helper,
 * and the body readers — no fetch, no ambient context, no logging. Each app's client seam owns
 * transport and ambient context (locale, credentials, the access token) and decides what a
 * reader's throw becomes; the web seam maps it to `unreachable` with a developer-facing log
 * that never contains the body (NFR-30), and the console does the same.
 */
export const API_OUTCOME = {
  /** The API answered inside the success envelope (§6.8). */
  Ok: 'ok',
  /** The API answered RFC 9457 problem+json — `title`/`detail` resolved, render as received. */
  Problem: 'problem',
  /**
   * The request never reached an answering API (network failure, or a non-problem gateway
   * error). Distinct rather than thrown: the screen renders NFR-79's three parts from the
   * BUNDLED catalogue, which is the outage the catalogues ship in the release for (OQ-43).
   */
  Unreachable: 'unreachable',
} as const;

export type ApiOutcomeStatus = (typeof API_OUTCOME)[keyof typeof API_OUTCOME];

export type ApiOutcome<T> =
  /**
   * `messages` are §6.8's envelope messages, already resolved (`key` + `text`) — `WARNING` is
   * how AD-5's `allow_with_warning` reaches a caller who still got what they asked for. Empty
   * on the no-body statuses (202/204).
   */
  | { status: typeof API_OUTCOME.Ok; value: T; messages: Message[] }
  | { status: typeof API_OUTCOME.Problem; problem: ProblemDocument }
  | { status: typeof API_OUTCOME.Unreachable };

/** A failed outcome — what a screen holds in state while it shows the error surface. */
export type ApiFailure = Exclude<ApiOutcome<never>, { status: typeof API_OUTCOME.Ok }>;

/**
 * A list call's `value`: the list envelope's data members under one name, so `ApiOutcome<T>`
 * stays the single container and every helper works on lists for free.
 */
export interface ListResult<T> {
  items: T[];
  total: number;
  totalpages: number;
}

/**
 * Projects a successful outcome's value and passes every failure through untouched — the one
 * place that knows failures survive projection (and that `messages` ride along).
 */
export function mapOutcome<T, U>(
  outcome: ApiOutcome<T>,
  project: (value: T) => U,
): ApiOutcome<U> {
  return outcome.status === API_OUTCOME.Ok
    ? { status: API_OUTCOME.Ok, value: project(outcome.value), messages: outcome.messages }
    : outcome;
}

/**
 * Reading a body **validates it rather than asserting over it**. A blind `as` cast reads a
 * missing `object` as `undefined` and a screen renders that as *empty* — a silent wrong
 * answer. These throw on a shape that is not the envelope; the caller decides what that
 * becomes (`unreachable`, in both apps). The thrown message is developer-facing, names the
 * shape, and **never the body** — it may carry personal data (NFR-30).
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export function readResultObject<TObject>(
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

export function readResultList<TObject>(
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
 * A problem document is repaired rather than rejected where it can be — a failure that arrives
 * slightly malformed is still a failure the user must be told about, and dropping it to
 * `unreachable` would replace "the address is already taken" with "try again later". RFC 9457
 * makes every member optional, so absence is valid: `type` falls back to the standard's own
 * `about:blank`, `status` to the HTTP status, and `title`/`detail` are simply omitted — the
 * screens fall back to catalogue copy, per the API's own "a missing key omits the member" rule.
 */
export function readProblemDocument(body: unknown, httpStatus: number): ProblemDocument {
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
