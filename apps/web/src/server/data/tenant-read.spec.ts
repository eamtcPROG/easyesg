import { PROBLEM_TYPE } from '@easyesg/contracts';
import { describe, expect, it, vi } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import { isNotFound, isPermissionRefusal } from './tenant-read';

// Throws outside a React Server environment by design; `api-client.spec.ts` records the same.
vi.mock('server-only', () => ({}));

const problem = (status: number, type: string) => ({ status: API_OUTCOME.Problem, problem: { type, status } }) as const;

/** The arms a tenant read tells apart (task 192): *not found* is its own, never *forbidden* and never *unreachable*. */
describe('the tenant read arms', () => {
  it('reads a 404 as not found — an unknown report, another organization’s, or one deleted', () => {
    expect(isNotFound(problem(404, 'https://easyesg.md/problems/not-found'))).toBe(true);
    expect(isNotFound(problem(403, PROBLEM_TYPE.InsufficientRole))).toBe(false);
    expect(isNotFound({ status: API_OUTCOME.Unreachable })).toBe(false);
    expect(isNotFound({ status: API_OUTCOME.Ok, value: null, messages: [] })).toBe(false);
  });

  it('keeps a refusal of the role apart from a missing report', () => {
    expect(isPermissionRefusal(problem(403, PROBLEM_TYPE.InsufficientRole))).toBe(true);
    expect(isPermissionRefusal(problem(404, 'https://easyesg.md/problems/not-found'))).toBe(false);
  });
});
