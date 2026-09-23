import { describe, expect, it } from 'vitest';
import { readFrame } from './read-frame';

const frame = { event: 'notification.unread_changed', organizationId: 'org-1', since: 1_790_000_000_000 };

describe('readFrame', () => {
  it('reads a frame of a catalogued event', () => {
    expect(readFrame(JSON.stringify(frame))).toEqual(frame);
  });

  it('keeps the three fields and nothing else', () => {
    expect(readFrame(JSON.stringify({ ...frame, accountIds: ['a'] }))).toEqual(frame);
  });

  it.each([
    ['an event the catalogue does not declare', JSON.stringify({ ...frame, event: 'report.changed' })],
    ['no organization', JSON.stringify({ ...frame, organizationId: '' })],
    ['a time that is not whole milliseconds', JSON.stringify({ ...frame, since: 1.5 })],
    ['text that is not JSON', 'hello'],
    ['JSON that is not an object', '42'],
    ['a binary message', new ArrayBuffer(4)],
  ])('drops %s', (_, data) => {
    expect(readFrame(data)).toBeNull();
  });
});
