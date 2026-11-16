import { runInRequestContext } from './request-context';
import { sharedRead, withSharedReads } from './shared-reads';

const context = () => ({ correlationId: 'c-1', locale: 'ro' as const });

describe('reads shared within a read-only request', () => {
  it('reads once per key inside the scope', async () => {
    let reads = 0;
    const read = () => sharedRead('report:r-1', () => Promise.resolve(++reads));
    await runInRequestContext(context(), () =>
      withSharedReads(async () => {
        expect(await Promise.all([read(), read()])).toEqual([1, 1]);
        expect(await read()).toBe(1);
      }),
    );
    expect(reads).toBe(1);
  });

  it('reads every time outside the scope, so a request that writes never answers from before its write', async () => {
    let reads = 0;
    const read = () => sharedRead('report:r-1', () => Promise.resolve(++reads));
    await runInRequestContext(context(), async () => {
      await read();
      await read();
    });
    expect(reads).toBe(2);
  });

  it('forgets what it read once the scope ends', async () => {
    let reads = 0;
    const read = () => sharedRead('report:r-1', () => Promise.resolve(++reads));
    await runInRequestContext(context(), async () => {
      await withSharedReads(read);
      await read();
    });
    expect(reads).toBe(2);
  });
});
