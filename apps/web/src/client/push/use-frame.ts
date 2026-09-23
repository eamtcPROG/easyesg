'use client';

import { useContext, useEffect, useEffectEvent } from 'react';
import type { EventName } from '@easyesg/contracts';
import { PushContext } from './push-provider';

/**
 * A surface's subscription to one event, for the organization it shows (task 149; AD-15).
 *
 * **`onFrame` must be the surface's existing, authorized refetch and nothing else** — no frame paints, since it carries
 * nothing to paint: the read it hurries is what the screen shows. **A frame for another organization is ignored**,
 * which is what its `organizationId` is for — an account-routed hint reaches every tab of the account, whichever
 * organization each is showing. `organizationId: null`, or no provider above, subscribes to nothing.
 *
 * `onFrame` is read at the frame, never at subscription, so a surface need not keep it stable.
 */
export function useFrame(input: {
  readonly event: EventName;
  readonly organizationId: string | null;
  readonly onFrame: () => void;
}): void {
  const hub = useContext(PushContext);
  const { event, organizationId } = input;
  const refetch = useEffectEvent(input.onFrame);

  useEffect(() => {
    if (hub === null || organizationId === null) return;
    return hub.subscribe(event, (frame) => {
      if (frame.organizationId === organizationId) refetch();
    });
  }, [hub, event, organizationId]);
}
