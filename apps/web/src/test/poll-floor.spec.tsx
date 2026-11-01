import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_CATALOGUE, EVENT_NAME, type EventName } from '@easyesg/contracts';
import { useUnreadCount } from '@/client/notifications/use-unread-count';
import { ACCELERATED_POLL_INTERVAL } from '@/client/polling/poll-schedule';
import { PushProvider } from '@/client/push/push-provider';
import { QueryProvider } from '@/client/query/query-provider';
import { AccessPoll } from '@/features/organization/access/components/poll/access-poll';

/**
 * **AD-15's floor, as a failing state** — task 149's deliverable (§12.5.6's task-149 row; NFR-110, UX-138): with the
 * socket forced off, every accelerated surface still reads its authority on its poll, on the poll's own schedule.
 *
 * **Keyed on the catalogue.** `SURFACES` is typed over every event the api may push, so an event added to the
 * catalogue fails `typecheck` here until its surface is mounted below — and the first case holds the keys equal at
 * run time too. A surface that answers its frames and has no poll is the one thing this refuses: push as the
 * authority, which nobody decided and no other check would see.
 *
 * **Forced off two ways, because a socket is off for two reasons in production**: no `PUBLIC_API_URL`, where none is
 * ever opened, and a socket refused on every attempt — a replica gone, an edge that drops the upgrade — where the
 * connection keeps backing off. **And once connected but silent**, which is NFR-110's second clause: no surface's
 * poll is lengthened because the accelerator covers it.
 *
 * **In `src/test/`** because its subject is no one feature: it reads `client/` and S-16's feature together, as the
 * folder spec beside it reads the whole tree.
 */

const ORGANIZATION = 'org-1';
const API_ORIGIN = 'http://localhost:3000';
const TICKET_PATH = '/api/v1/session/socket-ticket';
const UNREAD_PATH = '/api/v1/notifications/unread-count';

const refresh = vi.fn();
vi.mock('@/i18n/navigation', () => ({ useRouter: () => ROUTER }));
const ROUTER = { refresh };

/** A browser `WebSocket` stood in for: refused on every attempt, or open and silent, by the mode the case sets. */
class FakeWebSocket {
  static mode: 'refuse' | 'open' = 'refuse';
  static readonly opened: FakeWebSocket[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;

  constructor(readonly url: string) {
    FakeWebSocket.opened.push(this);
    setTimeout(() => {
      if (FakeWebSocket.mode === 'open') this.onopen?.(new Event('open'));
      else this.onclose?.(new CloseEvent('close', { code: 1006 }));
    }, 0);
  }

  close(): void {}

  send(frame: object): void {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(frame) }));
  }
}

const reads = vi.fn<(path: string) => void>();
const readsOf = (path: string) => reads.mock.calls.filter(([called]) => called === path).length;

function UnreadProbe() {
  useUnreadCount(ORGANIZATION);
  return null;
}

/** Each accelerated surface: how to mount it, and how many times it has read its authority. */
const SURFACES: Record<EventName, { readonly mount: () => React.ReactNode; readonly readCount: () => number }> = {
  [EVENT_NAME.NOTIFICATION_UNREAD_CHANGED]: {
    mount: () => <UnreadProbe />,
    readCount: () => readsOf(UNREAD_PATH),
  },
  [EVENT_NAME.ACCESS_CHANGED]: {
    mount: () => <AccessPoll organizationId={ORGANIZATION} readFailed={false} />,
    // S-16's read is the route's server render; the refresh is it being asked for.
    readCount: () => refresh.mock.calls.length,
  },
};

const mountUnder = (input: { readonly event: EventName; readonly apiOrigin: string | null }) =>
  render(
    <QueryProvider>
      <PushProvider apiOrigin={input.apiOrigin}>{SURFACES[input.event].mount()}</PushProvider>
    </QueryProvider>,
  );

beforeEach(() => {
  vi.useFakeTimers();
  FakeWebSocket.opened.length = 0;
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn((path: string) => {
      reads(path);
      const body = path === TICKET_PATH ? { object: { ticket: 't' }, messages: [] } : { object: { unread: 0 }, messages: [] };
      return Promise.resolve(new Response(JSON.stringify(body), { status: path === TICKET_PATH ? 201 : 200 }));
    }),
  );
  refresh.mockClear();
  reads.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** How many reads each interval should have produced by `elapsed`: the poll's own schedule, from the first read. */
const onSchedule = (input: { readonly event: EventName; readonly elapsed: number }) => {
  const initial = input.event === EVENT_NAME.NOTIFICATION_UNREAD_CHANGED ? 1 : 0;
  return initial + Math.floor(input.elapsed / ACCELERATED_POLL_INTERVAL[input.event]);
};

const MODES = [
  { name: 'with no socket configured', apiOrigin: null, socket: 'refuse' },
  { name: 'with the socket refused on every attempt', apiOrigin: API_ORIGIN, socket: 'refuse' },
  { name: 'with the socket connected and silent', apiOrigin: API_ORIGIN, socket: 'open' },
] as const;

describe('the poll floor under every accelerated surface', () => {
  it('covers every event the catalogue declares', () => {
    expect(Object.keys(SURFACES).sort()).toEqual(EVENT_CATALOGUE.map((entry) => entry.name).sort());
  });

  describe.each(MODES)('$name', ({ apiOrigin, socket }) => {
    it.each(EVENT_CATALOGUE.map((entry) => entry.name))(
      '%s reads its authority on its poll, on the poll’s own schedule',
      async (event) => {
        FakeWebSocket.mode = socket;
        mountUnder({ event, apiOrigin });
        const interval = ACCELERATED_POLL_INTERVAL[event];
        await act(() => vi.advanceTimersByTimeAsync(0));

        for (let round = 1; round <= 4; round += 1) {
          await act(() => vi.advanceTimersByTimeAsync(interval - 1));
          expect(SURFACES[event].readCount()).toBe(onSchedule({ event, elapsed: round * interval - 1 }));
          await act(() => vi.advanceTimersByTimeAsync(1));
          expect(SURFACES[event].readCount()).toBe(onSchedule({ event, elapsed: round * interval }));
        }

        // The socket was genuinely in the state the case names, or the case proved nothing.
        if (apiOrigin === null) expect(FakeWebSocket.opened).toHaveLength(0);
        else expect(FakeWebSocket.opened.length).toBeGreaterThan(0);
      },
    );
  });

  /** The accelerator itself, at the unit: a frame asks for the surface's own read, and only for its organization. */
  describe('a frame, while connected', () => {
    it.each(EVENT_CATALOGUE.map((entry) => entry.name))('%s triggers the read sooner than the poll', async (event) => {
      FakeWebSocket.mode = 'open';
      mountUnder({ event, apiOrigin: API_ORIGIN });
      await act(() => vi.advanceTimersByTimeAsync(0));
      const before = SURFACES[event].readCount();
      const socket = FakeWebSocket.opened[0];

      act(() => socket.send({ event, organizationId: 'another-org', since: 1 }));
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(SURFACES[event].readCount()).toBe(before);

      act(() => socket.send({ event, organizationId: ORGANIZATION, since: 1 }));
      await act(() => vi.advanceTimersByTimeAsync(0));
      expect(SURFACES[event].readCount()).toBe(before + 1);
    });
  });
});
