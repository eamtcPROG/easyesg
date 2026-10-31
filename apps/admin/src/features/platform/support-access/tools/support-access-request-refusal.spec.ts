import { API_OUTCOME, PROBLEM_TYPE, type ApiOutcome } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { isUnknownTicket } from './support-access-request-refusal';

const problem = (type: string): ApiOutcome<unknown> =>
  ({ status: API_OUTCOME.Problem, problem: { type, title: 'Refused', status: 422 } });

describe('isUnknownTicket (task 77)', () => {
  it('reads the unknown ticket as the field’s refusal', () => {
    expect(isUnknownTicket(problem(PROBLEM_TYPE.TicketReferenceUnknown))).toBe(true);
  });

  it('leaves every other refusal to the callout', () => {
    expect(isUnknownTicket(problem(PROBLEM_TYPE.SupportAccessRequired))).toBe(false);
    expect(isUnknownTicket({ status: API_OUTCOME.Ok, value: {} } as ApiOutcome<unknown>)).toBe(false);
  });
});
