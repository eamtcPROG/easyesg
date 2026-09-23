import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventFrame } from '@easyesg/contracts';
import { TICKET_MINT, type TicketMint } from './mint-socket-ticket';
import { PushConnection, type PushSocket } from './push-connection';

/** A socket the spec drives: it records what the connection did to it and lets the spec open, message and close it. */
class FakeSocket implements PushSocket {
  onopen: PushSocket['onopen'] = null;
  onmessage: PushSocket['onmessage'] = null;
  onclose: PushSocket['onclose'] = null;
  closedWith: number | undefined;

  constructor(readonly address: string) {}

  close(code?: number): void {
    this.closedWith = code;
  }

  open(): void {
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }

  receive(data: unknown): void {
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent('message', { data }));
  }

  drop(code: number): void {
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent('close', { code }));
  }
}

const FRAME: EventFrame = { event: 'access.changed', organizationId: 'org-1', since: 1 };

const harness = (mints: TicketMint[] = []) => {
  const sockets: FakeSocket[] = [];
  const frames: EventFrame[] = [];
  let issued = 0;
  const mintTicket = vi.fn((): Promise<TicketMint> => {
    issued += 1;
    return Promise.resolve(mints.shift() ?? { kind: TICKET_MINT.ISSUED, ticket: `t-${issued}` });
  });
  const connection = new PushConnection({
    apiOrigin: 'http://localhost:3000',
    onFrame: (frame) => frames.push(frame),
    deps: {
      openSocket: (address) => {
        const socket = new FakeSocket(address);
        sockets.push(socket);
        return socket;
      },
      mintTicket,
      setTimer: (run, delay) => setTimeout(run, delay),
      clearTimer: (timer) => clearTimeout(timer),
      // The middle of the draw: the first retry waits the base, 30 s.
      random: () => 0.5,
    },
  });
  return { connection, sockets, frames, mintTicket };
};

/** One tab's socket (task 149): open while wanted, retry with jitter, park where retrying would only repeat. */
describe('PushConnection', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('mints a ticket and opens the socket on the api with it, handing on each frame it can read', async () => {
    const { connection, sockets, frames } = harness();

    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();
    sockets[0].receive(JSON.stringify(FRAME));
    sockets[0].receive('not a frame');

    expect(sockets.map((socket) => socket.address)).toEqual(['ws://localhost:3000/api/v1/socket?ticket=t-1']);
    expect(frames).toEqual([FRAME]);
  });

  it('closes the socket when no longer wanted, and does not treat its own close as a loss', async () => {
    const { connection, sockets, mintTicket } = harness();
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);

    connection.want(false);
    sockets[0].drop(1000);
    await vi.advanceTimersByTimeAsync(600_000);

    expect(sockets[0].closedWith).toBe(1000);
    expect(mintTicket).toHaveBeenCalledTimes(1);
  });

  it('reconnects after an abnormal drop, on the jittered wait and not before', async () => {
    const { connection, sockets } = harness();
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();

    sockets[0].drop(1006);
    await vi.advanceTimersByTimeAsync(29_999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);
  });

  it('backs off further while the losses run, and starts again from the base once a socket opens', async () => {
    const { connection, sockets } = harness();
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);

    sockets[0].drop(1006);
    await vi.advanceTimersByTimeAsync(30_000);
    sockets[1].drop(1006);
    // Two losses running: half of a one-minute ceiling doubled.
    await vi.advanceTimersByTimeAsync(59_999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    sockets[2].open();

    sockets[2].drop(1001);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(sockets).toHaveLength(4);
  });

  it('parks a superseded socket until it is next wanted, rather than evicting another tab', async () => {
    const { connection, sockets, mintTicket } = harness();
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].open();

    sockets[0].drop(4001);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(mintTicket).toHaveBeenCalledTimes(1);

    connection.want(false);
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(sockets).toHaveLength(2);
  });

  it('parks when the session is refused a ticket, and retries one that failed', async () => {
    const refused = harness([{ kind: TICKET_MINT.REFUSED }]);
    refused.connection.want(true);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(refused.mintTicket).toHaveBeenCalledTimes(1);

    const failed = harness([{ kind: TICKET_MINT.FAILED }]);
    failed.connection.want(true);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(failed.mintTicket).toHaveBeenCalledTimes(2);
    expect(failed.sockets).toHaveLength(1);
  });

  it('opens nothing when a ticket arrives after the tab stopped wanting it', async () => {
    const { connection, sockets } = harness();
    connection.want(true);
    connection.want(false);
    await vi.advanceTimersByTimeAsync(0);

    expect(sockets).toHaveLength(0);
  });

  it('cancels a pending retry when no longer wanted', async () => {
    const { connection, sockets, mintTicket } = harness();
    connection.want(true);
    await vi.advanceTimersByTimeAsync(0);
    sockets[0].drop(1006);

    connection.want(false);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(mintTicket).toHaveBeenCalledTimes(1);
  });
});
