import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import userEvent from '@testing-library/user-event';
import { ConsequenceDialogue } from './consequence-dialogue';
import { Dialog } from './dialog';

/**
 * The dialogue's behaviour (task 170) — the half a specimen cannot show: it is named by its title, it
 * closes on Escape and on its control and NOT on an outside press, and a consequence dialogue opened
 * over it takes the press without closing the record beneath.
 */
const props = {
  open: true,
  title: 'Google',
  closeLabel: 'Close',
  onClose: () => undefined,
  children: <p>The provider's record.</p>,
};

/** Opened from a button by the caller's state — as every caller opens it — so where focus goes on close is observable. */
function Opened({ onCloseAutoFocus }: { readonly onCloseAutoFocus?: (event: Event) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <Dialog {...props} open={open} onClose={() => setOpen(false)} onCloseAutoFocus={onCloseAutoFocus} />
    </>
  );
}

/** Radix hands focus back a tick after the content unmounts. */
const afterTheHandBack = () => act(() => new Promise((resolve) => setTimeout(resolve, 10)));

describe('Dialog', () => {
  it('is a modal dialogue named by its title', () => {
    render(<Dialog {...props} description="How sign-in with Google behaves." />);

    const dialog = screen.getByRole('dialog', { name: 'Google' });
    expect(dialog).toHaveAccessibleDescription('How sign-in with Google behaves.');
    expect(screen.getByText("The provider's record.")).toBeInTheDocument();
  });

  it('reports a close on Escape and on its control', async () => {
    const onClose = vi.fn();
    render(<Dialog {...props} onClose={onClose} />);

    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  /** A stray click beside a half-edited form must not discard it. */
  it('does not close on a press outside it', async () => {
    const onClose = vi.fn();
    render(<Dialog {...props} onClose={onClose} />);
    // Radix registers its outside-press listener a tick after opening, so the press waits for it.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));

    // The overlay is the one open part that is not the dialogue — what a press beside it lands on.
    const overlay = document.querySelector('[data-state="open"]:not([role="dialog"])');
    expect(overlay).not.toBeNull();
    // The whole press: jsdom's event carries no pointer type, so Radix waits for the click as it would
    // for a touch — a pointer-down alone passes whether or not the guard is there.
    fireEvent.pointerDown(overlay as Element, { button: 0 });
    fireEvent.pointerUp(overlay as Element);
    fireEvent.click(overlay as Element);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('draws its closing row of actions', () => {
    render(<Dialog {...props} footer={<button type="button">Save</button>} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  /** One stacking world (§11.5): the confirmation is the top layer, and dismissing it leaves the record. */
  it('keeps the record open while a consequence dialogue over it is cancelled', async () => {
    const onClose = vi.fn();
    const onCancel = vi.fn();
    render(
      <Dialog {...props} onClose={onClose}>
        <ConsequenceDialogue
          open
          object="Google"
          title="Disable Google?"
          consequence="Sign-in with Google stops."
          confirmLabel="Disable"
          cancelLabel="Keep it"
          onConfirm={() => undefined}
          onCancel={onCancel}
        />
      </Dialog>,
    );

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  /** Task 207, UX-113: opened by the caller's state, not a Radix trigger, it still hands focus back to its opener. */
  it('returns focus on close to what opened it', async () => {
    render(<Opened />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    await afterTheHandBack();
    expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
  });

  /** A close that sends the reader elsewhere — S-08's finding followed to its field — keeps focus off the opener. */
  it('leaves focus where it is when the caller keeps it there', async () => {
    render(<Opened onCloseAutoFocus={(event) => event.preventDefault()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.keyboard('{Escape}');
    await afterTheHandBack();
    expect(screen.getByRole('button', { name: 'Open' })).not.toHaveFocus();
  });
});
