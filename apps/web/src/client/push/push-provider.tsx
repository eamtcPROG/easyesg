'use client';

import { createContext, useEffect, useState, type ReactNode } from 'react';
import { tabIsVisible } from '@/client/polling/tab-visibility';
import { mintSocketTicket } from './mint-socket-ticket';
import { FrameHub } from './frame-hub';
import { PushConnection } from './push-connection';

/** The tab's registry, for `useFrame`. `null` outside the provider, where nothing is ever pushed. */
export const PushContext = createContext<FrameHub | null>(null);

/**
 * AD-15's accelerator for the authenticated shell (task 149; §12.5.6's task-149 row) — one socket per tab, handing
 * each frame to the surfaces that subscribed through `useFrame`, and **drawing nothing**: UX-138 admits no connected,
 * disconnected or reconnecting state, which is honest only because every surface still polls its authority (NFR-110).
 *
 * **`apiOrigin` is `PUBLIC_API_URL`'s, read by the server at request time**, so no build inlines it; `null` means the
 * accelerator is off and no socket is ever opened — every surface runs on its poll alone, which is the floor.
 *
 * **Wanted while the tab is visible and a surface subscribes**, and closed otherwise: a hidden tab holds no place under
 * the account's ten connections, and no frame asks for a refetch OQ-36 has stopped. Reopened when the tab is shown,
 * which is also what releases a connection parked after a `4001` (`reconnect-policy.ts`).
 */
export function PushProvider({
  apiOrigin,
  children,
}: {
  readonly apiOrigin: string | null;
  readonly children: ReactNode;
}) {
  const [hub] = useState(() => new FrameHub());

  useEffect(() => {
    if (apiOrigin === null) return;
    const connection = new PushConnection({
      apiOrigin,
      onFrame: (frame) => hub.publish(frame),
      deps: {
        openSocket: (address) => new WebSocket(address),
        mintTicket: () => mintSocketTicket(),
        setTimer: (run, delay) => setTimeout(run, delay),
        clearTimer: (timer) => clearTimeout(timer),
      },
    });
    const sync = () => connection.want(tabIsVisible() && hub.demanded);
    hub.onDemand(sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      hub.onDemand(null);
      document.removeEventListener('visibilitychange', sync);
      connection.want(false);
    };
  }, [apiOrigin, hub]);

  return <PushContext.Provider value={hub}>{children}</PushContext.Provider>;
}
