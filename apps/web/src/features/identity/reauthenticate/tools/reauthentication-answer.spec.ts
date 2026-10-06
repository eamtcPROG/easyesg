import { describe, expect, it } from 'vitest';
import { FACTOR_LAPSED } from '../../shared/tools/factor';
import { REAUTHENTICATION, readReauthenticationAnswer } from './reauthentication-answer';

/**
 * The browser's reading of the two handlers (task 92). Literals are asserted on purpose: they are the
 * wire values, and a renamed constant must break this rather than follow it.
 */
describe('readReauthenticationAnswer', () => {
  it('reads an error status as the api’s problem document, at the status it came with', () => {
    const answer = readReauthenticationAnswer({
      ok: false,
      httpStatus: 401,
      body: {
        type: 'https://easyesg.md/problems/credential-invalid',
        status: 401,
        title: 'Autentificarea nu a reușit',
        detail: 'Adresa sau parola nu corespund.',
      },
    });
    expect(answer).toMatchObject({
      status: 'problem',
      problem: { status: 401, title: 'Autentificarea nu a reușit' },
    });
  });

  it('keeps an error status a problem even when its body is unreadable, repaired from the status', () => {
    expect(readReauthenticationAnswer({ ok: false, httpStatus: 503, body: null })).toMatchObject({
      status: 'problem',
      problem: { status: 503 },
    });
  });

  it('reads back each answer a success may name, the lapse included', () => {
    for (const status of [...Object.values(REAUTHENTICATION), FACTOR_LAPSED]) {
      if (status === REAUTHENTICATION.RECOVERED) continue;
      expect(readReauthenticationAnswer({ ok: true, httpStatus: 200, body: { status } })).toEqual({ status });
    }
    expect(readReauthenticationAnswer({ ok: true, httpStatus: 200, body: { status: 'resumed' } })).toEqual({
      status: 'resumed',
    });
  });

  // Task 190: the one answer that carries a value, validated like the status beside it.
  it('reads a recovery with the codes left, and no count from anything that is not a whole one', () => {
    const read = (remaining: unknown) =>
      readReauthenticationAnswer({ ok: true, httpStatus: 200, body: { status: 'recovered', remaining } });
    expect(read(3)).toEqual({ status: 'recovered', remaining: 3 });
    expect(read(0)).toEqual({ status: 'recovered', remaining: 0 });
    for (const odd of [null, undefined, -1, 2.5, '3']) {
      expect(read(odd)).toEqual({ status: 'recovered', remaining: null });
    }
  });

  it('treats a success it cannot read as unreachable, never as an answer', () => {
    for (const body of [null, 'resumed', {}, { status: 'signed_in' }, { status: 42 }]) {
      expect(readReauthenticationAnswer({ ok: true, httpStatus: 200, body })).toEqual({ status: 'unreachable' });
    }
  });
});
