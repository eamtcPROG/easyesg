import type { DisclosureValueWrite } from '@easyesg/contracts';

/**
 * The durable half of FR-38 (task 35.2): where unacknowledged changes wait between one page and the
 * next — and between one tab and the next, which is the case §4.10 names: *"an IndexedDB-backed
 * outbound queue that survives a tab close"*.
 *
 * **A port with two adapters, and the browser one is IndexedDB.** `localStorage` is synchronous and
 * quota-limited; a `BroadcastChannel` does not survive a close. IndexedDB is the one browser store
 * that is durable, asynchronous, and — the property that matters at a step change — orders
 * overlapping `readwrite` transactions across connections by creation, so the next step's read of
 * the queue waits for the previous step's write to commit rather than racing it.
 *
 * **A scope is an account and a report, never a report alone.** Two people can sign in on one
 * browser, and a queue keyed by report would let the second flush the first's changes under their
 * own session — refused by RLS if they are not a member, silently attributed to them if they are.
 * The key carries the account id, so a queue is only ever drained by the session that filled it.
 *
 * **Falls back to memory rather than failing.** A private window, a browser with site data blocked,
 * or a storage quota error would otherwise make the wizard refuse to load. In memory the queue
 * still coalesces and retries within the tab; what is lost is survival across a close, which the
 * hook reports through the same indicator rather than hiding.
 */
export interface PendingWriteStore {
  load(scope: string): Promise<readonly DisclosureValueWrite[]>;
  save(scope: string, writes: readonly DisclosureValueWrite[]): Promise<void>;
}

/** Whether the store survives the tab — what the fallback gives up, stated rather than hidden. */
export interface PendingWriteStoreHandle extends PendingWriteStore {
  readonly durable: boolean;
}

export const pendingWriteScope = (input: {
  readonly accountId: string;
  readonly reportId: string;
}): string => `${input.accountId}/${input.reportId}`;

const DATABASE_NAME = 'easyesg-autosave';
const DATABASE_VERSION = 1;
const STORE_NAME = 'pending';

const request = <T>(req: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
  });

const openDatabase = (indexedDb: IDBFactory): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const open = indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
    open.onupgradeneeded = () => {
      if (!open.result.objectStoreNames.contains(STORE_NAME)) {
        open.result.createObjectStore(STORE_NAME);
      }
    };
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(open.error ?? new Error('IndexedDB open failed'));
    open.onblocked = () => reject(new Error('IndexedDB open blocked'));
  });

const isWriteList = (value: unknown): value is DisclosureValueWrite[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as { elementKey?: unknown }).elementKey === 'string',
  );

/** The IndexedDB adapter. Each call opens and closes its own connection — the queue is small and
 *  a held connection blocks a version upgrade in another tab. */
export function indexedDbPendingWriteStore(indexedDb: IDBFactory): PendingWriteStoreHandle {
  return {
    durable: true,
    async load(scope) {
      const db = await openDatabase(indexedDb);
      try {
        const stored: unknown = await request<unknown>(
          db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(scope),
        );
        // Validated rather than cast: what is read back was written by an earlier build of this
        // code, and a shape it no longer recognises must not become a request body.
        return isWriteList(stored) ? stored : [];
      } finally {
        db.close();
      }
    },
    async save(scope, writes) {
      const db = await openDatabase(indexedDb);
      try {
        const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
        if (writes.length === 0) await request(store.delete(scope));
        else await request(store.put([...writes], scope));
      } finally {
        db.close();
      }
    },
  };
}

/** The in-memory adapter — the fallback, and what the hook's spec drives. */
export function memoryPendingWriteStore(): PendingWriteStoreHandle {
  const queues = new Map<string, readonly DisclosureValueWrite[]>();
  return {
    durable: false,
    load: (scope) => Promise.resolve(queues.get(scope) ?? []),
    save: (scope, writes) => {
      if (writes.length === 0) queues.delete(scope);
      else queues.set(scope, [...writes]);
      return Promise.resolve();
    },
  };
}

/**
 * The store this browser can give — IndexedDB where it works, memory from the first call that
 * fails. A browser can expose `indexedDB` and still refuse to open it (site data blocked, a quota
 * error, some private windows), so absence is not the only way to lose the durable store; the
 * demotion is permanent for the page, and `durable` reports it so the banner can say what was lost.
 */
export function browserPendingWriteStore(): PendingWriteStoreHandle {
  if (typeof indexedDB === 'undefined') return memoryPendingWriteStore();
  const memory = memoryPendingWriteStore();
  let active: PendingWriteStoreHandle = indexedDbPendingWriteStore(indexedDB);
  const demote = (): PendingWriteStoreHandle => {
    active = memory;
    return memory;
  };
  return {
    get durable() {
      return active.durable;
    },
    load: (scope) => active.load(scope).catch(() => demote().load(scope)),
    save: (scope, writes) => active.save(scope, writes).catch(() => demote().save(scope, writes)),
  };
}
