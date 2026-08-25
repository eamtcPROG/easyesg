import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';

/**
 * `Button`'s two shapes, and specifically the discriminator between them.
 *
 * The `asChild` seam was added for S-03 (task 26.3), whose primary action is a navigation. Its
 * first implementation discriminated on **key presence** — `'asChild' in props` — which meant
 * `asChild={false}`, and any spread carrying `asChild: undefined`, entered the Slot branch and
 * threw inside Radix's `React.Children.only`. TypeScript could not see either form: the first is
 * an excess-property case it happens to reject only for object literals, and the second is a
 * runtime spread. So the guard is a test.
 */
describe('Button (§11.5)', () => {
  it('renders a real button by default', () => {
    render(<Button onClick={() => undefined}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  /** The regression the value discriminator exists for. */
  it('renders a real button when asChild is explicitly false', () => {
    render(<Button asChild={false}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  /** The spread form, which no type check can catch. */
  it('renders a real button when asChild arrives undefined from a spread', () => {
    const forwarded = { asChild: undefined } as { asChild?: false };
    render(<Button {...forwarded}>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('lends its styling to the caller’s element when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/somewhere">Continue</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Continue' });
    expect(link).toBeInTheDocument();
    expect(link.className).not.toBe('');
  });

  /**
   * The component's own vocabulary must not reach the DOM: React forwards unknown attributes to
   * `<button>` and warns on every render. `busy` is the one that would.
   */
  it('keeps its own props off the element', () => {
    render(<Button busy>Saving</Button>);
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button.hasAttribute('busy')).toBe(false);
    expect(button.hasAttribute('asChild')).toBe(false);
    // `busy` is a state, not a disabled reason — but it does stop interaction, and says so.
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });
});
