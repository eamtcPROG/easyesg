import { describe, expect, it } from 'vitest';
import type { ApiFailure } from '@easyesg/contracts';
import { refusalCopy } from './refusal-copy';

/**
 * The refusal's words, member by member — the rule `RefusalCallout` and `ExpiringRefusal` both draw. The outcome's
 * `status` is written as its wire literal, per the root file's test exception.
 */
const UNREACHABLE = { title: 'No answer', body: 'Nothing was sent.', action: 'Try again.' };

const problem = (members: { readonly title?: string; readonly detail?: string }): ApiFailure => ({
  status: 'problem',
  problem: { type: 'https://easyesg.md/problems/conflict', status: 409, ...members },
});

describe('refusalCopy', () => {
  it('draws the api’s own words, with no action beside a detail that carries it', () => {
    expect(
      refusalCopy({
        failure: problem({ title: 'Already invited', detail: 'Withdraw the invitation first.' }),
        title: 'Fallback title',
        fallback: 'Fallback body',
        unreachable: UNREACHABLE,
      }),
    ).toStrictEqual({ title: 'Already invited', body: 'Withdraw the invitation first.', action: null });
  });

  it('falls back per member, keeping the one the api did send', () => {
    expect(
      refusalCopy({
        failure: problem({ detail: 'Withdraw the invitation first.' }),
        title: 'Fallback title',
        fallback: 'Fallback body',
        unreachable: UNREACHABLE,
      }),
    ).toStrictEqual({ title: 'Fallback title', body: 'Withdraw the invitation first.', action: null });

    expect(
      refusalCopy({
        failure: problem({ title: 'Already invited' }),
        title: 'Fallback title',
        fallback: 'Fallback body',
        unreachable: UNREACHABLE,
      }),
    ).toStrictEqual({ title: 'Already invited', body: 'Fallback body', action: null });
  });

  it('gives no answer the realm’s three parts', () => {
    expect(
      refusalCopy({
        failure: { status: 'unreachable' },
        title: 'Fallback title',
        fallback: 'Fallback body',
        unreachable: UNREACHABLE,
      }),
    ).toStrictEqual({ title: 'No answer', body: 'Nothing was sent.', action: 'Try again.' });
  });
});
