import type { EventFrame } from '@easyesg/contracts';
import { readFrame } from './read-frame';
import { AFTER_LOSS, LOSS, afterLoss, type Loss } from './reconnect-policy';
import { socketAddress } from './socket-address';
import { TICKET_MINT, type TicketMint } from './mint-socket-ticket';

/** The part of a browser `WebSocket` the connection uses — what the spec's fake implements. */
export type PushSocket = Pick<WebSocket, 'close' | 'onopen' | 'onmessage' | 'onclose'>;

/** What the connection reaches outside itself, injected so its spec runs on fakes. */
export interface PushConnectionDeps {
  readonly openSocket: (address: string) => PushSocket;
  readonly mintTicket: () => Promise<TicketMint>;
  readonly setTimer: (run: () => void, delay: number) => ReturnType<typeof setTimeout>;
  readonly clearTimer: (timer: ReturnType<typeof setTimeout>) => void;
  readonly random?: () => number;
}

/** A close this client asks for: the tab was hidden or nothing on it subscribes any more. */
const NORMAL_CLOSURE = 1000;

/**
 * One tab's socket to the api (task 149; AD-15, §12.5.6's task-149 row) — a ticket, a socket, and what to do when it
 * is lost. **It is an accelerator and nothing depends on it**: a frame it reads is handed to `onFrame`, and every
 * surface that listens polls its authority on its own schedule whether this is open, retrying, parked or never
 * started (UX-138, NFR-110).
 *
 * **It is open only while it is wanted** — the tab visible and a surface on it subscribing (`push-provider.tsx`
 * decides) — and `want(false)` closes it at once. **A loss retries or parks** by `afterLoss`, and a parked connection
 * waits for the next `want(true)`, which is the tab shown again or a screen that subscribes. **Every async step checks
 * it is still current**, by a generation counted on each `want`, so a mint that answers after the tab was hidden
 * opens nothing.
 */
export class PushConnection {
  private wanted = false;
  private generation = 0;
  private losses = 0;
  private socket: PushSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly input: {
      readonly apiOrigin: string;
      readonly onFrame: (frame: EventFrame) => void;
      readonly deps: PushConnectionDeps;
    },
  ) {}

  want(wanted: boolean): void {
    if (wanted === this.wanted) return;
    this.wanted = wanted;
    this.stop();
    if (wanted) {
      this.losses = 0;
      void this.connect();
    }
  }

  private stop(): void {
    this.generation += 1;
    if (this.timer !== null) this.input.deps.clearTimer(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket !== null) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.close(NORMAL_CLOSURE);
    }
  }

  private async connect(): Promise<void> {
    const generation = this.generation;
    const minted = await this.input.deps.mintTicket();
    if (generation !== this.generation) return;
    if (minted.kind !== TICKET_MINT.ISSUED) {
      this.lost({ kind: minted.kind === TICKET_MINT.REFUSED ? LOSS.REFUSED : LOSS.FAILED });
      return;
    }
    const socket = this.input.deps.openSocket(socketAddress({ apiOrigin: this.input.apiOrigin, ticket: minted.ticket }));
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket === socket) this.losses = 0;
    };
    socket.onmessage = (message) => {
      const frame = readFrame(message.data);
      if (frame !== null) this.input.onFrame(frame);
    };
    socket.onclose = (closed) => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.lost({ kind: LOSS.CLOSED, code: closed.code });
    };
  }

  private lost(loss: Loss): void {
    this.losses += 1;
    const decision = afterLoss({ loss, losses: this.losses, random: this.input.deps.random });
    if (decision.kind === AFTER_LOSS.PARK) return;
    const generation = this.generation;
    this.timer = this.input.deps.setTimer(() => {
      this.timer = null;
      if (generation === this.generation) void this.connect();
    }, decision.delay);
  }
}
