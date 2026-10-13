import { describe, expect, it } from 'vitest';
import { PROBLEM_TYPE } from '@easyesg/contracts';
import { readLegalControllerOutcome } from './legal-controller-read';

const CONTROLLER = {
  registeredName: 'EasyESG SRL',
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
};

describe('the read of the operator a legal document names (task 75)', () => {
  it('answers the operator when the read succeeds', () => {
    expect(readLegalControllerOutcome({ status: 'ok', value: CONTROLLER, messages: [] } as never)).toEqual({
      kind: 'ready',
      controller: CONTROLLER,
    });
  });

  it('reads the api’s own refusal as none in force, so the document answers not yet available', () => {
    expect(
      readLegalControllerOutcome({
        status: 'problem',
        problem: { type: PROBLEM_TYPE.LegalControllerUnavailable, status: 503 },
      } as never),
    ).toEqual({ kind: 'none_in_force' });
  });

  it('reads any other failure as a failed read, which keeps the frame', () => {
    expect(
      readLegalControllerOutcome({
        status: 'problem',
        problem: { type: 'https://easyesg.md/problems/internal', status: 500 },
      } as never),
    ).toEqual({ kind: 'failed' });
    expect(readLegalControllerOutcome({ status: 'unreachable' } as never)).toEqual({ kind: 'failed' });
  });
});
