import { describe, expect, it } from 'vitest';
import { draftOf, readDraft } from './rules-draft';

describe('a slot’s payload as A-05 edits it (task 67.8)', () => {
  it('reads an object back as the payload to send', () => {
    expect(readDraft('{ "rules": [] }')).toEqual({ payload: { rules: [] } });
  });

  it('names text that is not JSON, and JSON that is not an object', () => {
    expect(readDraft('{ rules: ')).toEqual({ fault: 'unparsable' });
    expect(readDraft('[1, 2]')).toEqual({ fault: 'not-an-object' });
    expect(readDraft('null')).toEqual({ fault: 'not-an-object' });
  });

  it('opens a payload indented, and reads it back unchanged', () => {
    const payload = { rules: [{ threshold: '50' }] };
    expect(draftOf(payload)).toContain('\n  "rules"');
    expect(readDraft(draftOf(payload))).toEqual({ payload });
  });
});
