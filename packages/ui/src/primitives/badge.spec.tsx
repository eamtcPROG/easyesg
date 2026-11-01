import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';
import { BADGE_TONE } from './badge-vocabulary';

/** Badge's contract (task 50.2.1): the number drawn, the words read, and never both said. */
describe('Badge', () => {
  it('draws the count and reads the words in its place', () => {
    const { container } = render(<Badge tone={BADGE_TONE.ALERT} count={4} label="4 unread notifications" />);

    expect(screen.getByText('4')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('4 unread notifications')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'alert');
    expect(container.firstElementChild).not.toHaveAttribute('aria-hidden');
  });

  it('hides itself whole where the caller already names the count', () => {
    const { container } = render(<Badge tone={BADGE_TONE.QUIET} count={12} />);

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild).toHaveAttribute('data-tone', 'quiet');
    expect(container).toHaveTextContent('12');
  });
});
