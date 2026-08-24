import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { createPublicKey, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';

/**
 * A minimal OIDC Authorization Server for the e2e suite — discovery, authorize, token and JWKS,
 * enough for the certified client on the api's side to complete a real code-flow round trip with
 * full ID-token validation (signature over JWKS, issuer, audience, expiry, nonce).
 *
 * Deliberately a stub, not `oidc-provider`: the STRICT half of the protocol runs in the adapter
 * under test via openid-client, so the fixture only has to play a well-behaved server — and a
 * hundred readable lines beat a second full AS implementation as a thing to debug when a test
 * goes red. It listens on plain http/127.0.0.1, which is why the api's e2e environment sets
 * `AUTH_SOCIAL_ALLOW_INSECURE=true`.
 *
 * Per-test knobs: `nextClaims` is what the next issued ID token asserts (subject, email,
 * verified flag, name). `authorizedRequests` records what the authorize endpoint was asked, so a
 * test can assert FR-2's minimum-scopes request actually left the platform.
 */
export interface StubClaims {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
}

interface PendingCode {
  readonly nonce: string | null;
  readonly claims: StubClaims;
}

export class OidcProviderStub {
  private readonly keyPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  private readonly keyId = randomBytes(8).toString('hex');
  private readonly pendingCodes = new Map<string, PendingCode>();
  private server: Server | null = null;

  issuer = '';

  nextClaims: StubClaims = {
    sub: 'stub-subject',
    email: 'stub@example.md',
    email_verified: true,
    name: 'Stub Person',
  };

  readonly authorizedRequests: URLSearchParams[] = [];
  readonly tokenRequests: URLSearchParams[] = [];

  async start(): Promise<void> {
    this.server = createServer((request, response) => this.route(request, response));
    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    const { port } = this.server?.address() as AddressInfo;
    this.issuer = `http://127.0.0.1:${port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server ? this.server.close((error) => (error ? reject(error) : resolve())) : resolve(),
    );
  }

  private route(request: IncomingMessage, response: ServerResponse): void {
    const url = new URL(request.url ?? '/', this.issuer);
    if (url.pathname === '/.well-known/openid-configuration') return this.discovery(response);
    if (url.pathname === '/authorize') return this.authorize(url, response);
    if (url.pathname === '/jwks') return this.jwks(response);
    if (url.pathname === '/token') {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString('utf8')));
      request.on('end', () => this.token(new URLSearchParams(body), response));
      return;
    }
    response.writeHead(404).end();
  }

  private discovery(response: ServerResponse): void {
    json(response, 200, {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/authorize`,
      token_endpoint: `${this.issuer}/token`,
      jwks_uri: `${this.issuer}/jwks`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  }

  private authorize(url: URL, response: ServerResponse): void {
    this.authorizedRequests.push(url.searchParams);
    const redirectUri = url.searchParams.get('redirect_uri');
    const state = url.searchParams.get('state');
    if (!redirectUri) return void response.writeHead(400).end('redirect_uri missing');

    const code = randomBytes(16).toString('base64url');
    this.pendingCodes.set(code, {
      nonce: url.searchParams.get('nonce'),
      claims: { ...this.nextClaims },
    });

    const location = new URL(redirectUri);
    location.searchParams.set('code', code);
    if (state) location.searchParams.set('state', state);
    response.writeHead(302, { location: location.href }).end();
  }

  private token(body: URLSearchParams, response: ServerResponse): void {
    this.tokenRequests.push(body);
    const pending = this.pendingCodes.get(body.get('code') ?? '');
    if (!pending) return json(response, 400, { error: 'invalid_grant' });
    this.pendingCodes.delete(body.get('code') ?? '');

    const now = Math.floor(Date.now() / 1000);
    const idToken = this.signJwt({
      iss: this.issuer,
      aud: body.get('client_id'),
      sub: pending.claims.sub,
      email: pending.claims.email,
      email_verified: pending.claims.email_verified,
      name: pending.claims.name,
      ...(pending.nonce ? { nonce: pending.nonce } : {}),
      iat: now,
      exp: now + 300,
    });

    json(response, 200, {
      access_token: randomBytes(16).toString('base64url'),
      token_type: 'Bearer',
      expires_in: 300,
      id_token: idToken,
    });
  }

  private jwks(response: ServerResponse): void {
    const jwk = createPublicKey(this.keyPair.publicKey).export({ format: 'jwk' });
    json(response, 200, { keys: [{ ...jwk, kid: this.keyId, alg: 'RS256', use: 'sig' }] });
  }

  private signJwt(payload: Record<string, unknown>): string {
    const encode = (part: Record<string, unknown>): string =>
      Buffer.from(JSON.stringify(part), 'utf8').toString('base64url');
    const signingInput = `${encode({ alg: 'RS256', typ: 'JWT', kid: this.keyId })}.${encode(payload)}`;
    const signature = createSign('RSA-SHA256')
      .update(signingInput)
      .sign(this.keyPair.privateKey)
      .toString('base64url');
    return `${signingInput}.${signature}`;
  }
}

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
};
