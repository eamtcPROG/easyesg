import { PROBLEM_TYPE } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from './api-outcome';
import { outcomeOwesLegalAcceptance } from './legal-acceptance-standing';

const problem = (type: string, status: number) =>
  ({ status: API_OUTCOME.Problem, problem: { type, status } }) as const;

describe('an answer saying the account owes an acceptance of the terms (task 195)', () => {
  it('is the api’s legal-acceptance-required refusal', () => {
    expect(outcomeOwesLegalAcceptance(problem(PROBLEM_TYPE.LegalAcceptanceRequired, 403))).toBe(true);
  });

  // A 403 is also a role refused or a setup unfinished, and each has a screen of its own.
  it('is no other refusal at the same status, and no success', () => {
    expect(outcomeOwesLegalAcceptance(problem(PROBLEM_TYPE.InsufficientRole, 403))).toBe(false);
    expect(outcomeOwesLegalAcceptance(problem(PROBLEM_TYPE.AccountSetupRequired, 403))).toBe(false);
    expect(outcomeOwesLegalAcceptance({ status: API_OUTCOME.Unreachable })).toBe(false);
  });
});
