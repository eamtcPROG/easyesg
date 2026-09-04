import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from './button';
import { BUTTON_TONE } from './button-vocabulary';
import styles from './button.module.css';

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
   * `tone` and its class (task 74.1), which shipped broken and past every gate.
   *
   * `BUTTON_TONE` used to be exported from this file, which carries `'use client'` — so the class
   * was applied correctly from a Client Component and `undefined` from a Server Component, where
   * `.filter(Boolean)` dropped it and the button rendered `--accent` on `--globalbar-surface`,
   * pine on pine. `tsc`, `eslint` and `next build` were all green and all correct to be.
   *
   * A jsdom spec cannot see the server boundary, so it cannot reproduce that. What it CAN do is
   * hold the half the boundary bug was hiding behind — that a `tone` reaching the component turns
   * into the class — which was proven absent: with the ternary replaced by `undefined`, all 98
   * tests in this package still passed. `e2e/web/public-header.spec.ts` covers the paint itself,
   * across the boundary and in a real browser.
   */
  describe('tone (§11.5, and orthogonal to variant)', () => {
    it('exports a class to apply at all', () => {
      // Without this the three assertions below would pass vacuously against `undefined`, which is
      // the shape the defect took in the first place.
      expect(styles.band).toBeTruthy();
    });

    it('takes the band pairing when the tone says so', () => {
      render(<Button tone={BUTTON_TONE.BAND}>Create an account</Button>);
      expect(screen.getByRole('button', { name: 'Create an account' })).toHaveClass(styles.band);
    });

    it('does not take it by default', () => {
      render(<Button>Save</Button>);
      expect(screen.getByRole('button', { name: 'Save' })).not.toHaveClass(styles.band);
    });

    /** The path the public header actually uses: its primary action is a navigation. */
    it('carries the pairing through the asChild seam', () => {
      render(
        <Button asChild tone={BUTTON_TONE.BAND}>
          <a href="/register">Continue</a>
        </Button>,
      );
      expect(screen.getByRole('link', { name: 'Continue' })).toHaveClass(styles.band);
    });
  });

  /**
   * The component's own vocabulary must not reach the DOM: React forwards unknown attributes to
   * `<button>` and warns on every render. `busy` is the one that would.
   */
  it('keeps its own props off the element', () => {
    render(
      <Button busy tone={BUTTON_TONE.BAND}>
        Saving
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Saving' });
    expect(button.hasAttribute('busy')).toBe(false);
    expect(button.hasAttribute('asChild')).toBe(false);
    expect(button.hasAttribute('tone')).toBe(false);
    // `busy` is a state, not a disabled reason — but it does stop interaction, and says so.
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });
});
