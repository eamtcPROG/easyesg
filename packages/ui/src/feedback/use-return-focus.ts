'use client';

import { useCallback, useRef } from 'react';
import { dialogueOrigin } from './dialogue-origin';

/**
 * **A dialogue hands focus back to what opened it** (task 207; UX-113, `design_spec.md` §10.4: *focus … shall always
 * return to a sensible origin*) — the two handlers a Radix dialogue's content takes, for one opened by its caller's
 * state rather than by Radix's own `Trigger`.
 *
 * **Why Radix alone does not.** A modal dialogue's content composes its close handler to cancel the focus scope's own
 * return and focus `triggerRef` instead — and only `Dialog.Trigger` sets that ref. `Dialog` and `ConsequenceDialogue`
 * are opened from state, by any button anywhere, so the ref is empty and focus fell to `body` on every close: a
 * keyboard reader was sent back to the top of the page. Measured in jsdom and in Radix's source (dialog 1.1.23).
 *
 * **The opener is what held focus as the dialogue opened** — read in `onOpenAutoFocus`, which the focus scope fires
 * before it moves focus inside — **or, raised from a menu, the menu's button** (`dialogueOrigin`), since the item
 * closes with its menu. **On close it is focused again if it is still in the document**; this handler runs first and
 * cancels Radix's empty hand-back.
 *
 * **A caller may keep focus where its close sends it** by calling `preventDefault()` in its own `onCloseAutoFocus`,
 * read first: S-08's sheet does, when a finding it lists is followed to its field.
 */
export function useReturnFocus(input: {
  /** The caller's own close handler, run first; `preventDefault()` there keeps focus where it is. */
  readonly onCloseAutoFocus?: ((event: Event) => void) | undefined;
}) {
  const opener = useRef<HTMLElement | null>(null);
  const { onCloseAutoFocus: callerClose } = input;

  const onOpenAutoFocus = useCallback(() => {
    opener.current = dialogueOrigin(document.activeElement);
  }, []);

  const onCloseAutoFocus = useCallback(
    (event: Event) => {
      const element = opener.current;
      opener.current = null;
      callerClose?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      if (element?.isConnected === true) element.focus();
    },
    [callerClose],
  );

  return { onOpenAutoFocus, onCloseAutoFocus };
}
