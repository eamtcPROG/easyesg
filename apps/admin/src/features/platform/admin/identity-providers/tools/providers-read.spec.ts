import { describe, expect, it } from 'vitest';
import type { IdentityProvider } from '@easyesg/contracts';
import { providerNamed, readProvidersOutcome } from './providers-read';

const GOOGLE = { provider: 'google', revision: 3 } as IdentityProvider;
const MICROSOFT = { provider: 'microsoft', revision: 1 } as IdentityProvider;

describe('A-18’s read (task 67.11)', () => {
  it('answers the providers when the read succeeds, and the realm’s arm when it does not', () => {
    expect(
      readProvidersOutcome({
        status: 'ok',
        value: { items: [GOOGLE, MICROSOFT], total: 2, totalPages: 1 },
        messages: [],
      } as never),
    ).toEqual({ kind: 'ready', providers: [GOOGLE, MICROSOFT] });
    expect(
      readProvidersOutcome({ status: 'problem', problem: { type: 'x', status: 403 } } as never),
    ).toEqual({ kind: 'forbidden' });
  });

  it('finds one provider by name, and nothing for a name it was not given', () => {
    expect(providerNamed({ providers: [GOOGLE, MICROSOFT], provider: 'microsoft' })).toBe(MICROSOFT);
    expect(providerNamed({ providers: [GOOGLE], provider: 'microsoft' })).toBeNull();
    expect(providerNamed({ providers: [GOOGLE], provider: undefined })).toBeNull();
    expect(providerNamed({ providers: [GOOGLE], provider: null })).toBeNull();
  });
});
