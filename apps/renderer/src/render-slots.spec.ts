import { describe, expect, it } from 'vitest';
import { renderSlots } from './render-slots.js';

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
};

describe('renderSlots', () => {
  it('runs as many at once as it has slots, and the rest in arrival order', async () => {
    const slots = renderSlots(1);
    const started: string[] = [];
    const first = deferred();
    const a = slots.run(async () => {
      started.push('a');
      await first.promise;
    });
    const b = slots.run(() => Promise.resolve(void started.push('b')));
    const c = slots.run(() => Promise.resolve(void started.push('c')));
    await Promise.resolve();
    expect(started).toEqual(['a']);
    first.resolve();
    await Promise.all([a, b, c]);
    expect(started).toEqual(['a', 'b', 'c']);
  });

  it('gives a slot back when the work fails', async () => {
    const slots = renderSlots(1);
    await expect(slots.run(() => Promise.reject(new Error('crashed')))).rejects.toThrow('crashed');
    await expect(slots.run(() => Promise.resolve('next'))).resolves.toBe('next');
  });
});
