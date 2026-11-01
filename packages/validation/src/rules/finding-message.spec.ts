import { describe, expect, it } from 'vitest';
import { FINDING_MESSAGE_PARTS, findingMessagePartKey, wordsFindingMessage } from './finding-message.js';

/** NFR-79's three parts as a shape (task 42; §12.5.6's task-42 row (2)). */
describe('a finding’s message', () => {
  const leaves = (...keys: string[]) => new Set(keys);
  const threeParts = ['validation.required.happened', 'validation.required.consequence', 'validation.required.action'];

  it('is the three parts, in reading order', () => {
    expect(FINDING_MESSAGE_PARTS).toEqual(['happened', 'consequence', 'action']);
    expect(findingMessagePartKey({ message: 'validation.sum.over', part: 'action' })).toBe('validation.sum.over.action');
  });

  it('is worded when exactly the three parts sit beneath the key', () => {
    expect(wordsFindingMessage({ leaves: leaves(...threeParts), message: 'validation.required' })).toBe(true);
  });

  it('is not worded by one sentence at the key, which carries one part where three are owed', () => {
    expect(wordsFindingMessage({ leaves: leaves('validation.required'), message: 'validation.required' })).toBe(false);
  });

  it('is not worded with a part missing, or a fourth part no reader renders', () => {
    expect(wordsFindingMessage({ leaves: leaves(...threeParts.slice(0, 2)), message: 'validation.required' })).toBe(
      false,
    );
    expect(
      wordsFindingMessage({ leaves: leaves(...threeParts, 'validation.required.why'), message: 'validation.required' }),
    ).toBe(false);
  });

  it('does not read a sibling key that shares the prefix as beneath it', () => {
    // `validation.required_any` begins with `validation.required` but is not under `validation.required.`.
    expect(
      wordsFindingMessage({
        leaves: leaves(...threeParts, 'validation.required_any.happened'),
        message: 'validation.required',
      }),
    ).toBe(true);
  });
});
