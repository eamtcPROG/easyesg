import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readDismissed, subscribeDismissed, writeDismissed } from './dismissed-notes';

const scope = { accountId: 'a-1', reportId: 'r-1' };

/**
 * A `Storage` held in memory. **Stubbed so the test owns both stores**: Node 26 defines a global `localStorage` that
 * answers `undefined` without `--localstorage-file`, and shadows jsdom's — and the tab's session store is stubbed beside
 * it so the spec can show nothing reaches the persistent one. A missing store is also the case the module must
 * survive, asserted last below with the stub removed.
 */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
});

/** Versioned, so a later shape of the value is a new key rather than a misread of this one. */
const KEY = 'easyesg.applicability-notes.v1.a-1.r-1';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('the dismissed-notes store', () => {
  it('reads nothing where nothing was written', () => {
    expect([...readDismissed(scope)]).toEqual([]);
  });

  it('reads back what it wrote, for that account and report only', () => {
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate']) });
    expect(sessionStorage.getItem(KEY)).toBe('["EmployeeTurnoverRate"]');
    expect([...readDismissed(scope)]).toEqual(['EmployeeTurnoverRate']);
    expect([...readDismissed({ accountId: 'a-2', reportId: 'r-1' })]).toEqual([]);
    expect([...readDismissed({ accountId: 'a-1', reportId: 'r-2' })]).toEqual([]);
  });

  it('removes the entry for an empty set rather than keeping one per report ever opened', () => {
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate']) });
    writeDismissed({ scope, dismissed: new Set() });
    expect(sessionStorage.length).toBe(0);
  });

  /**
   * Stage 2's close (§12.5.6): a dismissal lasts the tab's session and is never kept in the browser beyond it, so
   * `architecture.md` OQ-23's basis — no browser storage holds a preference — stays true of the build.
   */
  it('keeps a dismissal in the tab’s session store, and nothing in the persistent one', () => {
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate']) });
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it('reads a value it cannot parse, or one that is not a list of names, as nothing dismissed', () => {
    sessionStorage.setItem(KEY, '{not json');
    expect([...readDismissed(scope)]).toEqual([]);
    sessionStorage.setItem(KEY, JSON.stringify(['TotalWaterConsumption', 3, null]));
    expect([...readDismissed(scope)]).toEqual(['TotalWaterConsumption']);
  });

  it('answers nothing dismissed when the browser refuses the store, and does not throw writing to it', () => {
    const refusing = memoryStorage();
    refusing.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
    refusing.setItem = () => {
      throw new DOMException('denied', 'QuotaExceededError');
    };
    vi.stubGlobal('sessionStorage', refusing);
    expect([...readDismissed(scope)]).toEqual([]);
    expect(() => writeDismissed({ scope, dismissed: new Set(['x']) })).not.toThrow();
  });

  it('answers the same set while the stored string is unchanged — a snapshot React compares by identity', () => {
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate']) });
    const first = readDismissed(scope);
    expect(readDismissed(scope)).toBe(first);
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate', 'TotalWaterConsumption']) });
    expect(readDismissed(scope)).not.toBe(first);
    // Nothing stored is one identity too, or an empty store would never settle.
    expect(readDismissed({ accountId: 'a-9', reportId: 'r-9' })).toBe(readDismissed({ accountId: 'a-8', reportId: 'r-8' }));
  });

  it('tells this page’s readers of a write', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeDismissed(listener);
    writeDismissed({ scope, dismissed: new Set(['EmployeeTurnoverRate']) });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    writeDismissed({ scope, dismissed: new Set() });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('survives a browser with no store at all', () => {
    vi.stubGlobal('sessionStorage', undefined);
    expect([...readDismissed(scope)]).toEqual([]);
    expect(() => writeDismissed({ scope, dismissed: new Set(['x']) })).not.toThrow();
  });
});
