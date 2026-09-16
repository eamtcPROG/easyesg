import 'server-only';
import { PROBLEM_TYPE, type ProblemDocument } from '@easyesg/contracts';
import { NextResponse } from 'next/server';
import { API_OUTCOME, type ApiFailure } from '@/lib/api-outcome';
import { SESSION_ENDED_STATUS } from '@/lib/session-standing';
import type { ReauthenticationAnswerStatus } from '../tools/reauthentication-answer';

/**
 * How the session tier's three handlers answer (task 92) — written in one place, so the browser's two
 * readings of them (`readReauthenticationAnswer`, `probeSession`) have one writer to agree with.
 *
 * **Failures as HTTP, answers as a body.** A refusal the api gave is relayed as the api's own problem
 * document at its own status, wording included (NFR-79). An api that could not be reached is `503`
 * `about:blank`, which is what the pass-through says for the same fact. A request this tier will not act
 * on — a body that is not the shape, a write that failed the same-origin proof — carries its status and
 * nothing else: a sentence minted here would be wording in code (OQ-43), and a forger gets nothing to
 * calibrate against. Every answer is `no-store`, since each describes one browser's session at one
 * instant.
 */
const PROBLEM_MEDIA_TYPE = 'application/problem+json';

/** RFC 9457's "the status code is the whole story". */
const ABOUT_BLANK = 'about:blank';

const NO_STORE = 'no-store';

const UNREACHABLE_STATUS = 503;

const HELD_STATUS = 204;

const problem = (document: ProblemDocument): NextResponse =>
  NextResponse.json(document, {
    status: document.status,
    headers: { 'content-type': PROBLEM_MEDIA_TYPE, 'cache-control': NO_STORE },
  });

/** A `200` naming what happened. */
export const answered = (status: ReauthenticationAnswerStatus): NextResponse =>
  NextResponse.json({ status }, { headers: { 'cache-control': NO_STORE } });

/** What the api refused with, as it said it — or `503` where it said nothing. */
export const relayed = (failure: ApiFailure): NextResponse =>
  failure.status === API_OUTCOME.Problem
    ? problem(failure.problem)
    : problem({ type: ABOUT_BLANK, status: UNREACHABLE_STATUS });

/** A request this tier will not act on: `400`, a body that is not the shape; `403`, a cross-site write. */
export const refused = (status: 400 | 403): NextResponse => problem({ type: ABOUT_BLANK, status });

/** The probe's *ended* — the type and status the pass-through refuses a session-less write with. */
export const sessionEnded = (): NextResponse =>
  problem({ type: PROBLEM_TYPE.AuthenticationRequired, status: SESSION_ENDED_STATUS });

/** The probe's *held*. */
export const sessionHeld = (): NextResponse =>
  new NextResponse(null, { status: HELD_STATUS, headers: { 'cache-control': NO_STORE } });

/** A sign-out done: nothing to say, and the browser navigates on. */
export const signedOut = (): NextResponse =>
  new NextResponse(null, { status: HELD_STATUS, headers: { 'cache-control': NO_STORE } });
