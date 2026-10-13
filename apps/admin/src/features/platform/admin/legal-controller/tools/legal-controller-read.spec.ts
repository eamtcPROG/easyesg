import { describe, expect, it } from 'vitest';
import type { LegalControllerRecord } from '@easyesg/contracts';
import { readLegalControllerOutcome } from './legal-controller-read';

const RECORD = { registeredName: 'EasyESG SRL', revision: 2 } as LegalControllerRecord;

describe('A-21’s read (task 75)', () => {
  it('answers the record when the read succeeds, and the realm’s arm when it does not', () => {
    expect(readLegalControllerOutcome({ status: 'ok', value: RECORD, messages: [] } as never)).toEqual({
      kind: 'ready',
      record: RECORD,
    });
    expect(readLegalControllerOutcome({ status: 'problem', problem: { type: 'x', status: 403 } } as never)).toEqual({
      kind: 'forbidden',
    });
    expect(readLegalControllerOutcome({ status: 'problem', problem: { type: 'x', status: 401 } } as never)).toEqual({
      kind: 'signed_out',
    });
    expect(readLegalControllerOutcome({ status: 'unreachable' } as never)).toEqual({ kind: 'unavailable' });
  });
});
