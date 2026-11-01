import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDismissible } from './use-dismissible';

/** What the screen hands the hook: its outcome, or none. Typed once so `rerender` may pass `null`. */
interface Props {
  readonly outcome: object | null;
}

const withOutcome = (outcome: object | null): { initialProps: Props } => ({ initialProps: { outcome } });

/** The outcome shown after a dismissal is decided by identity: that object stays gone, any other one shows. */
describe('useDismissible', () => {
  it('shows nothing while there is no outcome', () => {
    const { result } = renderHook(() => useDismissible(null));
    expect(result.current[0]).toBeNull();
  });

  it('shows an outcome until it is dismissed, and not after', () => {
    const refused = { title: 'That is not your current password' };
    const { result, rerender } = renderHook(({ outcome }: Props) => useDismissible(outcome), withOutcome(refused));
    expect(result.current[0]).toBe(refused);

    act(() => result.current[1]());
    expect(result.current[0]).toBeNull();

    // Re-rendered with the same object — the screen's state still holds it — it stays dismissed.
    rerender({ outcome: refused });
    expect(result.current[0]).toBeNull();
  });

  it('shows the next submit’s outcome even when its words are the same', () => {
    const first = { title: 'That is not your current password' };
    const { result, rerender } = renderHook(({ outcome }: Props) => useDismissible(outcome), withOutcome(first));
    act(() => result.current[1]());

    const second = { title: 'That is not your current password' };
    rerender({ outcome: second });
    expect(result.current[0]).toBe(second);
  });

  it('shows an outcome again after the screen cleared it and set it back', () => {
    // S-15 hides a success while a field differs and shows the same notice when the edit is undone: an outcome that
    // was never dismissed must come back.
    const saved = { title: 'Profile saved' };
    const { result, rerender } = renderHook(({ outcome }: Props) => useDismissible(outcome), withOutcome(saved));
    rerender({ outcome: null });
    rerender({ outcome: saved });
    expect(result.current[0]).toBe(saved);
  });
});
