import { describe, expect, it } from 'vitest';
import { SECTION_READ, type CredentialsRead } from './credentials';
import { LAST_WAY_IN, lastWayIn, offersUnlink } from './last-way-in';

/**
 * The closing note's four answers and the unlink offer they decide (task 169). The one that matters most is the last
 * provider on an account with no password: its row must not offer *Unlink*, and every other row must.
 */
const read = (
  password: boolean | null,
  providers: readonly ('google' | 'microsoft')[] | null,
): Pick<CredentialsRead, 'password' | 'providers'> => ({
  password:
    password === null
      ? { status: SECTION_READ.UNREACHABLE }
      : {
          status: SECTION_READ.READY,
          value: password ? { set: true, changedAt: 1_770_888_600_000 } : { set: false, changedAt: null },
        },
  providers:
    providers === null
      ? { status: SECTION_READ.UNREACHABLE }
      : {
          status: SECTION_READ.READY,
          value: providers.map((provider) => ({ provider, assertedEmail: `${provider}@example.test` })),
        },
});

describe('lastWayIn', () => {
  it('names the password when nothing is linked', () => {
    expect(lastWayIn(read(true, []))).toEqual({ kind: LAST_WAY_IN.PASSWORD_ONLY });
  });

  it('names the password, and every provider as unlinkable, when both are held', () => {
    const way = lastWayIn(read(true, ['google', 'microsoft']));

    expect(way).toEqual({ kind: LAST_WAY_IN.PASSWORD_AND_PROVIDERS, providers: ['google', 'microsoft'] });
    expect(offersUnlink(way, 'google')).toBe(true);
    expect(offersUnlink(way, 'microsoft')).toBe(true);
  });

  it('names the one provider of an account with no password, and withholds its unlink', () => {
    const way = lastWayIn(read(false, ['google']));

    expect(way).toEqual({ kind: LAST_WAY_IN.LAST_PROVIDER, provider: 'google' });
    expect(offersUnlink(way, 'google')).toBe(false);
    // The rule is about that provider, not about unlinking in general.
    expect(offersUnlink(way, 'microsoft')).toBe(true);
  });

  it('offers any unlink while another provider remains', () => {
    const way = lastWayIn(read(false, ['google', 'microsoft']));

    expect(way).toEqual({ kind: LAST_WAY_IN.PROVIDERS_ONLY });
    expect(offersUnlink(way, 'google')).toBe(true);
  });

  it('says nothing when either read did not resolve, and leaves the refusal to the api', () => {
    expect(lastWayIn(read(null, ['google']))).toBeNull();
    expect(lastWayIn(read(false, null))).toBeNull();
    expect(offersUnlink(null, 'google')).toBe(true);
  });
});
