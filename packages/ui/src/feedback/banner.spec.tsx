import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Banner } from './banner';
import { CALLOUT_INTENT } from './callout';

/**
 * The banner's contract (task 35.2): polite, three-part, and never a dismiss control — the parts
 * that render identically when broken.
 */
describe('Banner (§8.3)', () => {
  it('is a polite status region carrying all three parts', () => {
    render(
      <Banner
        intent={CALLOUT_INTENT.ATTENTION}
        title="Changes not yet sent"
        action={<button type="button">Retry</button>}
      >
        Two changes are waiting for the connection.
      </Banner>,
    );

    const banner = screen.getByRole('status');
    expect(banner).toHaveTextContent('Changes not yet sent');
    expect(banner).toHaveTextContent('Two changes are waiting for the connection.');
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('is never assertive, whatever its intent', () => {
    // A standing condition re-rendered on every screen change must not talk over the reader's own
    // work — the error intent changes the colour role, not the announcement priority.
    render(
      <Banner intent={CALLOUT_INTENT.ERROR} title="Could not save" action={null}>
        Retrying shortly.
      </Banner>,
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders no action slot when the body already carries the next step', () => {
    const withAction = render(
      <Banner intent={CALLOUT_INTENT.INFO} title="Read-only" action={<a href="/periods">Open</a>}>
        Ask an administrator to reopen the period.
      </Banner>,
    );
    const slotsWithAction = withAction.container.querySelectorAll('div').length;
    withAction.unmount();

    const { container } = render(
      <Banner intent={CALLOUT_INTENT.INFO} title="Read-only" action={null}>
        Ask an administrator to reopen the period.
      </Banner>,
    );

    // Not an empty slot: an empty action region would still take its space and its gap.
    expect(container.querySelectorAll('div').length).toBe(slotsWithAction - 1);
  });
});
