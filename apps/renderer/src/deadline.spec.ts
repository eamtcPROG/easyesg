import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DeadlineExceededError, withDeadline } from './deadline.js';

describe('withDeadline', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('answers the work’s result when it settles in time, and kills nothing', async () => {
    const expire = vi.fn(() => Promise.resolve());
    const answer = withDeadline({ ms: 1000, work: () => Promise.resolve('pdf'), expire });
    await expect(answer).resolves.toBe('pdf');
    await vi.advanceTimersByTimeAsync(5000);
    expect(expire).not.toHaveBeenCalled();
  });

  it('kills a hung work at its deadline and refuses with the deadline', async () => {
    const expire = vi.fn(() => Promise.resolve());
    const answer = withDeadline({ ms: 1000, work: () => new Promise<never>(() => undefined), expire });
    const settled = expect(answer).rejects.toThrow(DeadlineExceededError);
    await vi.advanceTimersByTimeAsync(999);
    expect(expire).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await settled;
    expect(expire).toHaveBeenCalledOnce();
  });

  it('swallows the killed work’s own late failure', async () => {
    let fail: (reason: Error) => void = () => undefined;
    const work = () => new Promise<never>((_, reject) => (fail = reject));
    const answer = withDeadline({ ms: 10, work, expire: () => Promise.resolve() });
    const settled = expect(answer).rejects.toThrow(DeadlineExceededError);
    await vi.advanceTimersByTimeAsync(10);
    await settled;
    fail(new Error('Target page, context or browser has been closed'));
    await vi.advanceTimersByTimeAsync(0);
  });

  it('answers the deadline, after the kill, when the kill is what makes the work fail first', async () => {
    let fail: (reason: Error) => void = () => undefined;
    let killed = false;
    const work = () => new Promise<never>((_, reject) => (fail = reject));
    const expire = async () => {
      // Killing the browser rejects the launch waiting on it — before the kill itself has finished.
      fail(new Error('Failed to launch browser'));
      await new Promise((resolve) => setTimeout(resolve, 50));
      killed = true;
    };
    const settled = withDeadline({ ms: 10, work, expire }).then(
      () => null,
      (error: unknown) => ({ error, killed }),
    );
    await vi.advanceTimersByTimeAsync(10);
    await vi.advanceTimersByTimeAsync(50);
    expect(await settled).toEqual({ error: expect.any(DeadlineExceededError) as unknown, killed: true });
  });

  it('refuses with the deadline even when the kill itself fails', async () => {
    const answer = withDeadline({
      ms: 10,
      work: () => new Promise<never>(() => undefined),
      expire: () => Promise.reject(new Error('no such process')),
    });
    const settled = expect(answer).rejects.toThrow(DeadlineExceededError);
    await vi.advanceTimersByTimeAsync(10);
    await settled;
  });
});
