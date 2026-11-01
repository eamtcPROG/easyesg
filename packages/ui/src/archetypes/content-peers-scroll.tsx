'use client';

import { useEffect, useRef } from 'react';
import { ARIA_CURRENT } from '../navigation/nav-link-vocabulary';

/**
 * Scrolls a Content page's peer strip to the page being read (task 74.2; `design_spec.md` §4.6, resolved 9 Oct 2026):
 * the strip stays one row at every width, and at `compact` the last of the legal set's three is past the frame's edge
 * on arrival.
 *
 * **The strip's one piece of client code, and a leaf**, so `ContentPeers` and the shell around it stay Server
 * Components — §14.2 lets the framework cache this archetype and no other. It renders an empty span, reads its strip
 * as the span's parent, and sets the strip's `scrollLeft` directly — never `scrollIntoView`, which would move the page
 * too. A strip with room for every peer has nothing to scroll, and the browser clamps the value to zero.
 */
export function ContentPeersScroll() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const strip = marker.current?.parentElement;
    const current = strip?.querySelector<HTMLElement>(`[aria-current="${ARIA_CURRENT.PAGE}"]`);
    if (!strip || !current) return;
    strip.scrollLeft = current.offsetLeft - (strip.clientWidth - current.offsetWidth) / 2;
  }, []);

  return <span ref={marker} hidden />;
}
