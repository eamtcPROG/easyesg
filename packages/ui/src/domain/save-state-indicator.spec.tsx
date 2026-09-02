import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SAVE_STATE, SaveStateIndicator } from './save-state-indicator';

/**
 * The indicator's contract (task 35.2) — what UX-35 and UX-112 require and a visual check cannot
 * see: that it is a live region, that it reads without colour, and that every state has words.
 */
const labels = {
  [SAVE_STATE.SAVED]: 'Saved',
  [SAVE_STATE.SAVING]: 'Saving…',
  [SAVE_STATE.QUEUED]: 'Queued — no connection',
  [SAVE_STATE.FAILED]: 'Save failed',
};

describe('SaveStateIndicator (§6.7, UX-35)', () => {
  it('is a polite live region that names its state in text', () => {
    render(<SaveStateIndicator state={SAVE_STATE.SAVED} labels={labels} regionLabel="Save state" />);

    const region = screen.getByRole('status', { name: 'Save state' });
    // Text-labelled, not an icon alone: the words are in the region, and the mark is hidden from
    // assistive technology so the announcement is the label and nothing else.
    expect(region).toHaveTextContent('Saved');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders every state with its own words', () => {
    for (const state of Object.values(SAVE_STATE)) {
      const { unmount } = render(
        <SaveStateIndicator state={state} labels={labels} regionLabel="Save state" />,
      );
      expect(screen.getByRole('status')).toHaveTextContent(labels[state]);
      expect(screen.getByRole('status')).toHaveAttribute('data-state', state);
      unmount();
    }
  });

  it('keeps the same node in the live region across a same-state render (UX-112)', () => {
    const { rerender } = render(
      <SaveStateIndicator state={SAVE_STATE.SAVED} labels={labels} regionLabel="Save state" />,
    );
    const before = screen.getByText('Saved');

    // A keystroke re-renders the step. A live region announces when its content is REPLACED, not
    // when it differs — so the label element must survive the render, not merely read the same.
    // A `key` that changes per render, or a label rebuilt from a timestamp, fails here.
    rerender(
      <SaveStateIndicator state={SAVE_STATE.SAVED} labels={labels} regionLabel="Save state" />,
    );
    expect(screen.getByText('Saved')).toBe(before);

    rerender(
      <SaveStateIndicator state={SAVE_STATE.QUEUED} labels={labels} regionLabel="Save state" />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Queued — no connection');
  });
});
