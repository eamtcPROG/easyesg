import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CALLOUT_INTENT } from './callout';
import { NOTICE_DWELL_MS } from './dwell';
import { ExpiringCallout } from './expiring-callout';

/**
 * A submit's message, as §8.1 has it since 28 Sep 2026: three parts in the region its intent calls for, a close
 * control outside it, and a dwell that counts only time the notice could have been read — for a refusal as for a
 * success.
 *
 * **Leaving is observed through `onDismiss`, not a class.** The frame reports once its collapse ends, and ignores an
 * animation end while it is not leaving — so firing `animationEnd` is a probe: it dismisses exactly when the component
 * has decided to go, and not before. jsdom runs no animations, which is why the spec fires it by hand.
 *
 * **Under both names, because jsdom makes React listen for the prefixed one.** React picks the animation-end event at
 * load: with no `AnimationEvent` in `window` but `WebkitAnimation` in a style object — jsdom's case, measured — it binds
 * `webkitAnimationEnd`, where every browser this ships to binds `animationend`. Firing both reaches whichever is bound,
 * and the `toHaveBeenCalledTimes(1)` below would go red if both ever were.
 */
const endAnimation = (element: Element) => {
  fireEvent.animationEnd(element);
  fireEvent(element, new Event('webkitAnimationEnd', { bubbles: true }));
};

const renderNotice = () => {
  const onDismiss = vi.fn();
  const view = render(
    <ExpiringCallout
      intent={CALLOUT_INTENT.SUCCESS}
      title="Profile saved"
      action={null}
      dismissLabel="Close this message"
      onDismiss={onDismiss}
    >
      The new values apply to reports created from now on.
    </ExpiringCallout>,
  );
  // The frame is the element the collapse runs on: the status region's parent's parent.
  const frame = screen.getByRole('status').parentElement?.parentElement;
  if (!frame) throw new Error('the notice renders no frame');
  const probe = () => endAnimation(frame);
  return { ...view, onDismiss, frame, probe };
};

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('ExpiringCallout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('is a polite region with all three parts, and its close control is not inside it', () => {
    render(
      <ExpiringCallout
        intent={CALLOUT_INTENT.SUCCESS}
        title="Invitation sent"
        action={<a href="#people">See it in the list</a>}
        dismissLabel="Close this message"
        onDismiss={() => undefined}
      >
        The link works for seven days.
      </ExpiringCallout>,
    );

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Invitation sent');
    expect(status).toHaveTextContent('The link works for seven days.');
    expect(status).toHaveTextContent('See it in the list');
    // Outside the region, so announcing the confirmation does not read the button's name as a fourth part.
    expect(status).not.toContainElement(screen.getByRole('button', { name: 'Close this message' }));
  });

  it('announces a refusal assertively, and a refusal leaves after the dwell too', () => {
    const onDismiss = vi.fn();
    render(
      <ExpiringCallout
        intent={CALLOUT_INTENT.ERROR}
        title="The change could not be saved"
        action={null}
        dismissLabel="Close this message"
        onDismiss={onDismiss}
      >
        That is not your current password.
      </ExpiringCallout>,
    );
    const alert = screen.getByRole('alert');
    const frame = alert.parentElement?.parentElement;
    if (!frame) throw new Error('the notice renders no frame');

    advance(NOTICE_DWELL_MS);
    endAnimation(frame);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves when the reader closes it, once its collapse has run', () => {
    const { onDismiss, probe } = renderNotice();

    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Close this message' }));
    expect(onDismiss).not.toHaveBeenCalled();
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('leaves on its own once it has been readable for the whole dwell', () => {
    const { onDismiss, probe } = renderNotice();

    advance(NOTICE_DWELL_MS - 1);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    advance(1);
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('ignores an animation ending inside it', () => {
    const { onDismiss } = renderNotice();
    fireEvent.click(screen.getByRole('button', { name: 'Close this message' }));

    endAnimation(screen.getByRole('status'));
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('holds while a pointer is on it, and resumes with what it had left', () => {
    const { onDismiss, frame, probe } = renderNotice();

    advance(3000);
    fireEvent.pointerEnter(frame);
    advance(60_000);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(frame);
    advance(NOTICE_DWELL_MS - 3000 - 1);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();
    advance(1);
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('holds while focus is on it', () => {
    const { onDismiss, probe } = renderNotice();
    const close = screen.getByRole('button', { name: 'Close this message' });

    act(() => close.focus());
    advance(60_000);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => close.blur());
    advance(NOTICE_DWELL_MS);
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('holds while the tab is hidden', () => {
    const { onDismiss, probe } = renderNotice();
    const setVisibility = (state: DocumentVisibilityState) => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
    };

    setVisibility('hidden');
    advance(60_000);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    setVisibility('visible');
    advance(NOTICE_DWELL_MS);
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('counts nothing until at least half of it is on screen', () => {
    let report: (ratio: number) => void = () => undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          report = (ratio) =>
            act(() => {
              callback([{ intersectionRatio: ratio } as IntersectionObserverEntry], this as never);
            });
        }
        observe() {}
        disconnect() {}
      },
    );
    const { onDismiss, probe } = renderNotice();

    // Mounted below the fold: nothing has reported where it is, so nothing counts.
    advance(60_000);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    report(0.4);
    advance(60_000);
    probe();
    expect(onDismiss).not.toHaveBeenCalled();

    report(1);
    advance(NOTICE_DWELL_MS);
    probe();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
