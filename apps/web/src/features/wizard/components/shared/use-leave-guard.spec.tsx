import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ro from '@/messages/ro.json';
import { useLeaveGuard } from './use-leave-guard';

/** The queue as the step holds it — changed by a case, between renders. */
const queue = { hasUnsynced: false, unsynced: 0 };
const push = vi.fn();

vi.mock('@/i18n/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../providers/autosave-context', () => ({ useAutosaveContext: () => queue }));
// A session still held: the guard's own question is what these cases are about.
vi.mock('../providers/use-when-session-held', () => ({ useWhenSessionHeld: () => (then: () => void) => then() }));

function Leaving() {
  const { leave, guard } = useLeaveGuard();
  return (
    <>
      <button type="button" onClick={() => leave('/reports/r1/preview')}>
        Leave
      </button>
      {guard}
    </>
  );
}

const leaving = () =>
  render(
    <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
      <Leaving />
    </NextIntlClientProvider>,
  );

/** Leaving the step for elsewhere in the app, with UX-37's question where answers are not yet sent (task 43.2). */
describe('useLeaveGuard', () => {
  beforeEach(() => {
    queue.hasUnsynced = false;
    queue.unsynced = 0;
  });
  afterEach(() => push.mockReset());

  it('goes at once where nothing is unsent', () => {
    leaving();
    act(() => screen.getByRole('button', { name: 'Leave' }).click());
    expect(push).toHaveBeenCalledWith('/reports/r1/preview');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('asks first where an answer is not yet sent, and goes nowhere until answered', () => {
    queue.hasUnsynced = true;
    queue.unsynced = 1;
    leaving();
    act(() => screen.getByRole('button', { name: 'Leave' }).click());
    expect(screen.getByRole('alertdialog', { name: ro.organization.wizard.leave.title })).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('goes where it was asked to once the queue drains while it asks — nothing is at stake any more', () => {
    queue.hasUnsynced = true;
    queue.unsynced = 1;
    const { rerender } = leaving();
    act(() => screen.getByRole('button', { name: 'Leave' }).click());
    expect(push).not.toHaveBeenCalled();

    // The answer in flight is acknowledged.
    queue.hasUnsynced = false;
    queue.unsynced = 0;
    rerender(
      <NextIntlClientProvider locale="ro" messages={{ organization: ro.organization }}>
        <Leaving />
      </NextIntlClientProvider>,
    );
    expect(push).toHaveBeenCalledWith('/reports/r1/preview');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
