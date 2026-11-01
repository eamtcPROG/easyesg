import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { failureNotice, noticeFromOutcome, successNotice } from './notice';

/**
 * The outcome-to-notice rule, which was two copies until 28 Aug 2026 — S-16's and S-28's, already
 * drifted. What is pinned here is the part a browser journey cannot reach: a problem document is
 * allowed to omit either member (RFC 9457), and each screen renders whichever half arrived.
 */
const unreachable = { title: 'No answer', body: 'Nothing was changed.' };

describe('failureNotice', () => {
  it('renders the API’s own text as received', () => {
    const notice = failureNotice({
      outcome: {
        status: API_OUTCOME.Problem,
        problem: {
          type: 'https://easyesg.md/problems/credential-invalid',
          status: 422,
          title: 'That is not your current password',
          detail: 'Check it and try again.',
        },
      },
      unreachable,
    });

    expect(notice).toMatchObject({
      title: 'That is not your current password',
      body: 'Check it and try again.',
    });
  });

  it('falls back per member, not per document', () => {
    // A problem carrying a detail and no title must KEEP that detail: dropping it replaces the
    // API's specific refusal with the generic outage sentence, which is a different answer.
    const notice = failureNotice({
      outcome: {
        status: API_OUTCOME.Problem,
        problem: {
          type: 'https://easyesg.md/problems/too-many-requests',
          status: 429,
          detail: 'Wait a few minutes.',
        },
      },
      unreachable,
    });

    expect(notice.title).toBe(unreachable.title);
    expect(notice.body).toBe('Wait a few minutes.');
  });

  it('has no "what now" unless the screen owns one', () => {
    // The default is `null` because NFR-79 has the API compose all three parts into `detail`.
    // S-28 shipped "Try again." beneath a throttle refusal that said to wait; this is that fix.
    expect(failureNotice({ outcome: { status: API_OUTCOME.Unreachable }, unreachable }).action)
      .toBeNull();
    expect(
      failureNotice({
        outcome: { status: API_OUTCOME.Unreachable },
        unreachable,
        action: 'Or reload the page.',
      }).action,
    ).toBe('Or reload the page.');
  });
});

describe('successNotice', () => {
  it('carries the copy it is given, and nothing to do by default', () => {
    const notice = successNotice({ copy: { title: 'Done', body: 'It worked.' } });
    expect(notice).toEqual({ intent: 'success', title: 'Done', body: 'It worked.', action: null });
  });
});

describe('noticeFromOutcome', () => {
  it('is the two halves, chosen by the discriminator', () => {
    const args = { success: { title: 'Done', body: 'It worked.' }, unreachable };

    expect(
      noticeFromOutcome({ ...args, outcome: { status: API_OUTCOME.Ok, value: null, messages: [] } }),
    ).toMatchObject({ intent: 'success', title: 'Done' });

    expect(
      noticeFromOutcome({ ...args, outcome: { status: API_OUTCOME.Unreachable } }),
    ).toMatchObject({ intent: 'error', title: unreachable.title });
  });
});
