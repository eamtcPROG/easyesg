import type { EventFrame, EventName } from '@easyesg/contracts';

type FrameListener = (frame: EventFrame) => void;

/**
 * Who on the tab is listening for which event (task 149) — the one registry the socket hands frames to, and the one
 * place that knows whether anything on the screen wants a socket at all.
 *
 * **Demand is the listener count crossing zero**, reported to `onDemand`, so the provider opens the socket only where
 * a surface subscribes: S-04 and S-35 carry no bell, and hold no place under the account's ten.
 */
export class FrameHub {
  private readonly listeners = new Map<EventName, Set<FrameListener>>();
  private count = 0;
  private demandListener: (() => void) | null = null;

  get demanded(): boolean {
    return this.count > 0;
  }

  /** Called whenever `demanded` may have changed. One reader: the provider. */
  onDemand(listener: (() => void) | null): void {
    this.demandListener = listener;
  }

  subscribe(event: EventName, listener: FrameListener): () => void {
    const forEvent = this.listeners.get(event) ?? new Set<FrameListener>();
    this.listeners.set(event, forEvent);
    forEvent.add(listener);
    this.count += 1;
    this.demandListener?.();
    return () => {
      if (!forEvent.delete(listener)) return;
      this.count -= 1;
      this.demandListener?.();
    };
  }

  publish(frame: EventFrame): void {
    for (const listener of this.listeners.get(frame.event) ?? []) listener(frame);
  }
}
