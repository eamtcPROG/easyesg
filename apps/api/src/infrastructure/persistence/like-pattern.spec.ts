import { escapeLikePattern } from './like-pattern';

describe('escapeLikePattern', () => {
  it('escapes the two wildcards and the escape itself, and nothing else', () => {
    expect(escapeLikePattern('50%_off!')).toBe('50!%!_off!!');
    expect(escapeLikePattern('Ana Popescu')).toBe('Ana Popescu');
  });
});
