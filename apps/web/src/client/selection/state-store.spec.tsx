import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { createStateStore, type StateStore } from './state-store';
import { useStoreSelector } from './use-store-selector';

afterEach(cleanup);

interface Held {
  readonly a: number;
  readonly b: number;
  readonly list: readonly number[];
}

function Reader({
  store,
  pick,
  onRender,
}: {
  readonly store: StateStore<Held>;
  readonly pick: 'a' | 'b';
  readonly onRender: () => void;
}) {
  const value = useStoreSelector(store, (held) => held[pick]);
  onRender();
  return <output>{value}</output>;
}

function ListReader({ store, onRender }: { readonly store: StateStore<Held>; readonly onRender: () => void }) {
  // A fresh array per selection: equal by content, never by identity.
  const list = useStoreSelector(
    store,
    (held) => held.list.filter((n) => n > 0),
    (previous, next) => previous.length === next.length && previous.every((n, i) => n === next[i]),
  );
  onRender();
  return <output>{list.join(',')}</output>;
}

describe('a state store read by selection', () => {
  it('re-renders a reader only when its own slice moves', () => {
    const store = createStateStore<Held>({ a: 1, b: 1, list: [] });
    const readsA = { count: 0 };
    const readsB = { count: 0 };
    const view = render(
      <>
        <Reader store={store} pick="a" onRender={() => (readsA.count += 1)} />
        <Reader store={store} pick="b" onRender={() => (readsB.count += 1)} />
      </>,
    );
    act(() => store.publish({ ...store.get(), a: 2 }));
    expect(view.container.textContent).toBe('21');
    expect(readsA.count).toBe(2);
    expect(readsB.count).toBe(1);
  });

  it('keeps an equal selection, so a fresh array of the same values renders nothing', () => {
    const store = createStateStore<Held>({ a: 1, b: 1, list: [1, -1, 2] });
    const reads = { count: 0 };
    render(<ListReader store={store} onRender={() => (reads.count += 1)} />);
    act(() => store.publish({ ...store.get(), list: [1, 2, -5] }));
    expect(reads.count).toBe(1);
    act(() => store.publish({ ...store.get(), list: [1, 2, 3] }));
    expect(reads.count).toBe(2);
  });

  it('notifies nobody when the same object is published again', () => {
    const held: Held = { a: 1, b: 1, list: [] };
    const store = createStateStore(held);
    let calls = 0;
    store.subscribe(() => {
      calls += 1;
    });
    store.publish(held);
    expect(calls).toBe(0);
    store.publish({ ...held });
    expect(calls).toBe(1);
  });
});
