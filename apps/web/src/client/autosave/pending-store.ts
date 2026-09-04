import type { DisclosureValueWrite } from '@easyesg/contracts';

/**
 * The durable half of FR-38 (task 35.2): where unacknowledged changes wait between one page and the
 * next — and between one tab and the next, which is the case §4.10 names: *"an IndexedDB-backed
 * outbound queue that survives a tab close"*.
 *
 * **A port with two adapters, and the browser one is IndexedDB.** `localStorage` is synchronous and
 * quota-limited; a `BroadcastChannel` does not survive a close. IndexedDB is the one browser store
 * that is durable, asynchronous, and — the property that matters at a step change — orders
 * `readwrite` transactions on one connection by creation, so the next step's read of the queue
 * waits for the previous step's write to commit rather than racing it.
 *
 * **That ordering is a property of the transaction, not of the call, which is why the connection is
 * held** (4 Sep 2026). This paragraph said *"across connections"* and the adapter opened a fresh one
 * per call, so the transaction was created only after an `await` — and the ordering guarantee never
 * covered the gap in front of it. Measured on the task-36.2 browser journey: a tab closed inside
 * that `await` **five times in eight**, and the queued change was gone when the report was next
 * opened — the failure §4.10's sentence exists to forbid, with the indicator saying *queued*
 * throughout, since the reducer's own set was right and only the durable mirror was wrong.
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

/**
 * The IndexedDB adapter, over **one connection held for the page's lifetime**.
 *
 * **Once that connection is open, a `save` needs no macrotask** — and that, rather than speed, is
 * the durability argument. Opening a database completes on an event, so a `save` that opens one
 * yields the thread and the tab can close in the gap; a `save` over a standing connection creates
 * its transaction inside the **microtask drain of the task that changed the value**, which finishes
 * before the browser can take the close off the queue at all. The module docblock has the numbers.
 *
 * A held connection blocks another tab's version upgrade, which is why the per-call open was
 * chosen originally; `versionchange` is the answer to that rather than never holding one — the
 * connection is given up the moment an upgrade wants it, and the next call reopens.
 */
export function indexedDbPendingWriteStore(indexedDb: IDBFactory): PendingWriteStoreHandle {
  // `ready` is what an immediate `save` needs; `opening` coalesces concurrent first calls.
  let ready: IDBDatabase | null = null;
  let opening: Promise<IDBDatabase> | null = null;
  // Every operation is chained behind the last, because each `save` carries the WHOLE queue and a
  // late one overtaking an early one leaves the store holding the older snapshot. Measured: with
  // the connection held but the calls unordered, the first save of a page still awaits the open
  // while the next takes the ready path and passes it — and the queue kept the state from *before*
  // the reporter's change (one run in six, 4 Sep 2026).
  let tail: Promise<unknown> = Promise.resolve();

  const forget = (): void => {
    ready = null;
    opening = null;
  };

  const connect = (): Promise<IDBDatabase> => {
    if (ready !== null) return Promise.resolve(ready);
    opening ??= openDatabase(indexedDb).then(
      (db) => {
        // Another tab upgrading the schema is blocked while this connection stands, so give it up
        // and reopen on the next call. `onclose` covers the browser closing it under us.
        db.onversionchange = () => {
          db.close();
          forget();
        };
        db.onclose = () => forget();
        ready = db;
        opening = null;
        return db;
      },
      (reason: unknown) => {
        forget();
        throw reason;
      },
    );
    return opening;
  };

  const writeTo = (
    db: IDBDatabase,
    scope: string,
    writes: readonly DisclosureValueWrite[],
  ): Promise<void> => {
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME);
    const settled =
      writes.length === 0 ? request(store.delete(scope)) : request(store.put([...writes], scope));
    return settled.then(() => undefined);
  };

  /** One operation, behind everything already asked for. A failure does not poison the chain. */
  const inTurn = <T>(work: (db: IDBDatabase) => Promise<T>): Promise<T> => {
    const settled = tail.then(() => connect()).then((db) => {
      try {
        return work(db);
      } catch {
        // `transaction()` throws rather than rejecting when the connection closed under us — an
        // upgrade in another tab. Give the handle up and take a fresh one, once.
        forget();
        return connect().then(work);
      }
    });
    tail = settled.catch(() => undefined);
    return settled;
  };

  return {
    durable: true,
    load(scope) {
      return inTurn((db) =>
        request<unknown>(
          db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(scope),
        ).then((stored) =>
          // Validated rather than cast: what is read back was written by an earlier build of this
          // code, and a shape it no longer recognises must not become a request body.
          isWriteList(stored) ? stored : [],
        ),
      );
    },
    save(scope, writes) {
      return inTurn((db) => writeTo(db, scope, writes));
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
