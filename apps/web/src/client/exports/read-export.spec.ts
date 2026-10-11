import { describe, expect, it, vi } from 'vitest';
import { readExport } from './read-export';

const EXPORT = { id: 'e1', format: 'pdf', locale: 'en', status: 'completed' };

const answering = (status: number, body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

/** S-11's watch (task 47.3): the export through the pass-through, or `null` for anything it cannot use. */
describe('readExport', () => {
  it('reads the export from the envelope, through the pass-through, with the session cookie', async () => {
    const send = answering(200, { object: EXPORT, messages: [] });

    await expect(readExport({ exportId: 'e1', fetch: send })).resolves.toEqual(EXPORT);
    expect(send).toHaveBeenCalledWith('/api/v1/exports/e1', expect.objectContaining({ credentials: 'same-origin', cache: 'no-store' }));
  });

  it.each([
    ['a refusal', answering(403, { type: 'insufficient-role' })],
    ['a body that is not the envelope', answering(200, EXPORT)],
    ['another export', answering(200, { object: { ...EXPORT, id: 'e2' }, messages: [] })],
    ['a status the card does not know', answering(200, { object: { ...EXPORT, status: 'archived' }, messages: [] })],
    ['a format the card does not know', answering(200, { object: { ...EXPORT, format: 'xbrl' }, messages: [] })],
    ['no answer', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'))],
  ])('answers null for %s', async (_case, send) => {
    await expect(readExport({ exportId: 'e1', fetch: send })).resolves.toBeNull();
  });
});
