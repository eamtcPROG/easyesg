import { describe, expect, it } from 'vitest';
import { readRenderRequest, RenderRequestRefusedError } from './render-request.js';

const MARKUP = '<!doctype html><html lang="en"><body></body></html>';

describe('readRenderRequest', () => {
  it('admits a whole document and an instant', () => {
    expect(readRenderRequest(JSON.stringify({ markup: MARKUP, generatedAt: 1_791_000_000_000 }))).toEqual({
      markup: MARKUP,
      generatedAt: 1_791_000_000_000,
    });
  });

  it.each([
    ['not JSON', '<!doctype html>'],
    ['not an object', '"text"'],
    ['a fragment rather than a document', JSON.stringify({ markup: '<p>hi</p>', generatedAt: 1 })],
    ['no instant', JSON.stringify({ markup: MARKUP })],
    ['an instant as text', JSON.stringify({ markup: MARKUP, generatedAt: '2026-10-11' })],
    ['a fractional instant', JSON.stringify({ markup: MARKUP, generatedAt: 1.5 })],
  ])('refuses %s', (_, body) => {
    expect(() => readRenderRequest(body)).toThrow(RenderRequestRefusedError);
  });
});
