import { describe, expect, it } from 'vitest';
import { socketAddress } from './socket-address';

describe('socketAddress', () => {
  it('opens the socket on the api origin, with the ticket as its query parameter', () => {
    expect(socketAddress({ apiOrigin: 'http://localhost:3000', ticket: 'abc' })).toBe(
      'ws://localhost:3000/api/v1/socket?ticket=abc',
    );
  });

  it('takes wss where the api is served over TLS, and ignores any path on the origin', () => {
    expect(socketAddress({ apiOrigin: 'https://api.example.md/api/v1', ticket: 'abc' })).toBe(
      'wss://api.example.md/api/v1/socket?ticket=abc',
    );
  });

  it('escapes the ticket rather than trusting its alphabet', () => {
    expect(socketAddress({ apiOrigin: 'http://localhost:3000', ticket: 'a+b&c' })).toBe(
      'ws://localhost:3000/api/v1/socket?ticket=a%2Bb%26c',
    );
  });
});
