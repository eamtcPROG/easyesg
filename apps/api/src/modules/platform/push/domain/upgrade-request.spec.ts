import { judgeUpgrade } from './upgrade-request';

/** The upgrade's judgement before any socket exists (task 147). Literals: the wire values. */
describe('judgeUpgrade (task 147)', () => {
  const allowedOrigin = 'https://app.easyesg.md';

  it('hands over the ticket of an upgrade for this socket from the tenant application', () => {
    expect(
      judgeUpgrade({ url: '/api/v1/socket?ticket=abc', origin: 'https://app.easyesg.md', allowedOrigin }),
    ).toEqual({ refused: null, ticket: 'abc' });
  });

  it('refuses a foreign or absent origin, then a missing ticket — in that order', () => {
    expect(judgeUpgrade({ url: '/api/v1/socket?ticket=abc', origin: 'https://evil.example', allowedOrigin })).toEqual({
      refused: 403,
    });
    expect(judgeUpgrade({ url: '/api/v1/socket?ticket=abc', origin: undefined, allowedOrigin })).toEqual({
      refused: 403,
    });
    expect(judgeUpgrade({ url: '/api/v1/socket', origin: allowedOrigin, allowedOrigin })).toEqual({ refused: 401 });
    expect(judgeUpgrade({ url: '/api/v1/socket?ticket=', origin: allowedOrigin, allowedOrigin })).toEqual({
      refused: 401,
    });
  });

  // The configured public URL may carry a path or a trailing slash; only its origin is compared.
  it('compares origins, not the configured URL as written', () => {
    expect(
      judgeUpgrade({ url: '/api/v1/socket?ticket=abc', origin: 'https://app.easyesg.md', allowedOrigin: 'https://app.easyesg.md/' }),
    ).toEqual({ refused: null, ticket: 'abc' });
  });
});
