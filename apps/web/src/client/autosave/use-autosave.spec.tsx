import { DISCLOSURE_STATE, type DisclosureValueWrite } from '@easyesg/contracts';
import { SAVE_STATE } from '@easyesg/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveStateOf, writeKey } from '@/features/wizard/autosave-state';
import { memoryPendingWriteStore } from './pending-store';
import { TRANSPORT_RETRIES, retryDelay, useAutosave } from './use-autosave';

/**
 * The wiring's contract (task 35.2) — the three properties no browser journey can hold still long
 * enough to see: the acknowledgement follows the response and never precedes it (NFR-56); a
 * change made while a flush is out is not lost to that flush's acknowledgement; and the durable
 * queue is restored before anything is written back to it.
 */
const write = (elementKey: string, valueNumeric: string): DisclosureValueWrite => ({
  elementKey,
  valueNumeric,
  state: DISCLOSURE_STATE.OK,
});

const committedRow = (w: DisclosureValueWrite) => ({
  id: `id-${w.elementKey}`,
  elementKey: w.elementKey,
  dimensionKey: '',
  ordinal: 0,
  valueNumeric: w.valueNumeric ?? null,
  valueText: null,
  valueBoolean: null,
  valueDate: null,
  unitCode: null,
  state: w.state,
  notAvailableReason: null,
  carriedForward: false,
  updatedAt: 1,
});

/** A fetch whose answer the test releases by hand, so the request is observably in flight. */
function controllableFetch() {
  const calls: { body: { values: DisclosureValueWrite[] }; resolve: (r: Response) => void }[] = [];
  const fetchImpl = vi.fn(
    (_: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((resolve) => {
        calls.push({
          body: JSON.parse(init?.body as string) as { values: DisclosureValueWrite[] },
          resolve,
        });
      }),
  );
  const answer = (index: number) => {
    const call = calls[index];
    if (!call) throw new Error(`no request ${index}`);
    call.resolve(
      new Response(
        JSON.stringify({
          objects: call.body.values.map(committedRow),
          total: call.body.values.length,
          totalpages: 1,
          messages: [],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  };
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls, answer };
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('useAutosave', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('acknowledges after the response and not before, and moves to saving past the budget', async () => {
    const { fetchImpl, calls, answer } = controllableFetch();
    const store = memoryPendingWriteStore();
    const { result } = renderHook(
      () => useAutosave({ reportId: 'r1', scope: 'a/r1', store, fetch: fetchImpl }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));

    act(() => result.current.change(write('NumberOfEmployees', '42')));
    await waitFor(() => expect(calls).toHaveLength(1));

    // On the wire and unacknowledged: inside the budget the indicator still says saved (UX-36)…
    expect(saveStateOf(result.current.state)).toBe(SAVE_STATE.SAVED);
    expect(result.current.state.inFlight).not.toBeNull();
    // …and past it, saving — never a false saved.
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(saveStateOf(result.current.state)).toBe(SAVE_STATE.SAVING);

    act(() => answer(0));
    await waitFor(() => expect(saveStateOf(result.current.state)).toBe(SAVE_STATE.SAVED));
    expect(result.current.state.pending).toEqual({});
    expect(result.current.state.committed[writeKey({ elementKey: 'NumberOfEmployees' })]?.valueNumeric).toBe('42');
    // And the durable queue is empty again.
    expect(await store.load('a/r1')).toEqual([]);
  });

  it('keeps a change made during a flush and sends it in the next one', async () => {
    const { fetchImpl, calls, answer } = controllableFetch();
    const { result } = renderHook(
      () => useAutosave({ reportId: 'r1', scope: 'a/r1', store: memoryPendingWriteStore(), fetch: fetchImpl }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));

    act(() => result.current.change(write('A', '1')));
    await waitFor(() => expect(calls).toHaveLength(1));
    act(() => result.current.change(write('A', '2')));
    act(() => result.current.change(write('B', '3')));

    act(() => answer(0));
    // The second flush carries what accumulated — A's newer value and B — and nothing else.
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]?.body.values.map((v) => `${v.elementKey}:${v.valueNumeric}`)).toEqual(['A:2', 'B:3']);

    act(() => answer(1));
    await waitFor(() => expect(result.current.state.pending).toEqual({}));
  });

  it('restores the durable queue at mount and flushes it without a new change', async () => {
    const { fetchImpl, calls, answer } = controllableFetch();
    const store = memoryPendingWriteStore();
    await store.save('a/r1', [write('Turnover', '1000')]);

    const { result } = renderHook(
      () => useAutosave({ reportId: 'r1', scope: 'a/r1', store, fetch: fetchImpl }),
      { wrapper },
    );

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body.values[0]?.valueNumeric).toBe('1000');
    act(() => answer(0));
    await waitFor(() => expect(result.current.state.pending).toEqual({}));
    // The queue was drained, not merely re-read: the store no longer holds it.
    expect(await store.load('a/r1')).toEqual([]);
  });

  it('does not write the queue back before it has been read, and flushes what the read returned', async () => {
    // A store whose `load` resolves only when released — the memory fake reads synchronously and
    // so can never observe the ordering this guards: without the `hydrated` gate the first render's
    // empty set would wipe a queue that has not been read yet.
    let release: (writes: DisclosureValueWrite[]) => void = () => undefined;
    const saves: (readonly DisclosureValueWrite[])[] = [];
    const store = {
      durable: true,
      load: () => new Promise<readonly DisclosureValueWrite[]>((resolve) => { release = resolve; }),
      save: (_scope: string, writes: readonly DisclosureValueWrite[]) => {
        saves.push(writes);
        return Promise.resolve();
      },
    };
    const { fetchImpl, calls, answer } = controllableFetch();
    const { result } = renderHook(
      () => useAutosave({ reportId: 'r1', scope: 'a/r1', store, fetch: fetchImpl }),
      { wrapper },
    );

    await act(() => vi.advanceTimersByTimeAsync(50));
    expect(saves).toEqual([]);
    expect(result.current.state.hydrated).toBe(false);

    act(() => release([write('Turnover', '1000')]));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]?.body.values[0]?.valueNumeric).toBe('1000');
    act(() => answer(0));
    await waitFor(() => expect(result.current.state.pending).toEqual({}));
    // The first write-back happens after the read, and the last one empties the queue.
    expect(saves.length).toBeGreaterThan(0);
    expect(saves[saves.length - 1]).toEqual([]);
  });

  it('retries an unreachable API the scheduled number of times, then reports the failure with the change still pending', async () => {
    // Real timers and a zero delay: the count is the claim here; the curve is asserted below.
    vi.useRealTimers();
    const fetchImpl = vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))) as unknown as typeof fetch;
    const { result } = renderHook(
      () =>
        useAutosave({
          reportId: 'r1',
          scope: 'a/r1',
          store: memoryPendingWriteStore(),
          fetch: fetchImpl,
          retrySchedule: { retries: TRANSPORT_RETRIES, delayMs: () => 0 },
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));

    act(() => result.current.change(write('A', '1')));
    await waitFor(() => expect(saveStateOf(result.current.state)).toBe(SAVE_STATE.FAILED));
    // The first attempt plus three retries — and then the reducer hears of it, not before.
    expect(fetchImpl).toHaveBeenCalledTimes(TRANSPORT_RETRIES + 1);
    expect(result.current.state.failure).toEqual({ kind: 'unreachable' });
    expect(Object.keys(result.current.state.pending)).toHaveLength(1);
  });

  it('backs off exponentially and caps at thirty seconds', () => {
    expect([0, 1, 2, 3].map(retryDelay)).toEqual([1000, 2000, 4000, 8000]);
    expect(retryDelay(10)).toBe(30_000);
  });

  it('records a refusal with the API’s own document and does not retry on its own', async () => {
    const fetchImpl = vi.fn(
      () =>
        new Response(
          JSON.stringify({ type: 'urn:x:locked', status: 409, title: 'Locked', detail: 'The period is locked.' }),
          { status: 409, headers: { 'content-type': 'application/problem+json' } },
        ),
    ) as unknown as typeof fetch;
    const { result } = renderHook(
      () => useAutosave({ reportId: 'r1', scope: 'a/r1', store: memoryPendingWriteStore(), fetch: fetchImpl }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.state.hydrated).toBe(true));

    act(() => result.current.change(write('A', '1')));
    await waitFor(() => expect(saveStateOf(result.current.state)).toBe(SAVE_STATE.FAILED));
    expect(result.current.state.failure).toMatchObject({ kind: 'refused', problem: { status: 409 } });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // The change is still pending — nothing was lost to the refusal.
    expect(Object.keys(result.current.state.pending)).toHaveLength(1);

    act(() => result.current.retry());
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  });
});
