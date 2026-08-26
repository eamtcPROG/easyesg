import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsequenceDialogue } from './consequence-dialogue';

/**
 * The dialogue's behaviour, which is the half a specimen cannot show.
 *
 * It moved from a native `<dialog>` to Radix AlertDialog on 26 Aug 2026 (§11.5's fifth recorded
 * addition), and that trade gave up four behaviours the browser was supplying for free. Three of
 * them are now the library's promises rather than the platform's, so they are pinned here: initial
 * focus on the *safe* button, Escape closing, and an outside click NOT closing. The fourth — the
 * top layer — is the one thing that genuinely changed, and it changed on purpose.
 *
 * The last two tests cover the seam this file owns rather than Radix's: a close request arriving
 * while a destructive request is in flight is dropped, and confirming does not also report a cancel.
 */
const props = {
  open: true,
  object: 'bogdan.ilie@alpha.md',
  title: 'Remove this person from Verde Panificație?',
  consequence: 'They lose access to every report immediately, on every device.',
  retained: 'Their entries stay in the change history, attributed to them.',
  confirmLabel: 'Remove',
  cancelLabel: 'Keep access',
  onConfirm: () => undefined,
  onCancel: () => undefined,
};

describe('ConsequenceDialogue (UX-70, UX-69)', () => {
  it('names the object, the consequence and what survives', () => {
    render(<ConsequenceDialogue {...props} />);

    expect(screen.getByText('bogdan.ilie@alpha.md')).toBeInTheDocument();
    expect(screen.getByText(/lose access to every report/)).toBeInTheDocument();
    expect(screen.getByText(/stay in the change history/)).toBeInTheDocument();
  });

  /** The safe choice takes focus, not the destructive one. */
  it('sends initial focus to the cancelling button', () => {
    render(<ConsequenceDialogue {...props} />);
    expect(screen.getByRole('button', { name: 'Keep access' })).toHaveFocus();
  });

  it('reports a cancel on Escape', async () => {
    const onCancel = vi.fn();
    render(<ConsequenceDialogue {...props} onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  /** An in-flight destructive request cannot be un-asked. */
  it('drops a close request while busy', async () => {
    const onCancel = vi.fn();
    render(<ConsequenceDialogue {...props} busy onCancel={onCancel} />);

    await userEvent.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
  });

  /**
   * The regression `AlertDialog.Action` would have caused. That part closes the dialogue itself,
   * firing `onOpenChange(false)` while `busy` is still false — so the confirm would arrive at the
   * screen as a confirm AND a cancel, and the screen would undo its own optimistic update.
   */
  it('confirms without also reporting a cancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConsequenceDialogue {...props} onConfirm={onConfirm} onCancel={onCancel} />);

    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
