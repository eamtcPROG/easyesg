import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VERSION_PIN_STANDING, VersionPinIndicator } from './version-pin-indicator';

/**
 * The version pin indicator's contract (task 32.1.1) — the parts that render identically when
 * broken, which is the only reason a presentational component earns a spec.
 */
describe('VersionPinIndicator', () => {
  it('shows the release identifier verbatim, because a reader quotes it', () => {
    render(<VersionPinIndicator label="Taxonomy version" version="2026-05-01" />);

    // Exact text, not a substring: DR-4 is only checkable by a user if the pin on the screen is the
    // pin in the data, and a truncated or reformatted identifier is a different string to quote.
    expect(screen.getByText('2026-05-01')).toBeInTheDocument();
    expect(screen.getByText('Taxonomy version')).toBeInTheDocument();
  });

  /**
   * `translate="no"` is the assertion, not decoration. A browser's page translation rewriting
   * `2026-05-01` would rewrite the one thing on the screen a reader is meant to copy — and it would
   * do it only for readers using translation, which no other test here would ever see.
   */
  it('marks the identifier as not translatable', () => {
    render(<VersionPinIndicator label="Taxonomy version" version="2026-05-01" />);

    expect(screen.getByText('2026-05-01')).toHaveAttribute('translate', 'no');
  });

  /**
   * The props union now makes this **unrepresentable** in TypeScript — the in-force arm types
   * `standingLabel` and `note` as `never`, so this call does not compile without the cast. The cast
   * is the escape a JavaScript caller still has, which is why the runtime behaviour is asserted
   * rather than left to the type: a prop silently ignored is a caller believing something is on the
   * screen.
   */
  it('renders neither the standing nor the notice when the pin is in force', () => {
    render(
      <VersionPinIndicator
        label="Taxonomy version"
        version="2026-05-01"
        {...({ note: 'A newer version exists.', standingLabel: 'Superseded' } as Record<
          string,
          string
        >)}
      />,
    );

    expect(screen.queryByText('Superseded')).not.toBeInTheDocument();
    expect(screen.queryByText('A newer version exists.')).not.toBeInTheDocument();
  });

  /**
   * UX-48: a superseded pin "shall not proceed silently". This is that requirement as a test — the
   * component must be able to say so, or the first screen to meet a superseded pin invents the
   * state itself, which is the UX-89 defect one component late.
   */
  it('names the superseded standing in text, not only in colour', () => {
    render(
      <VersionPinIndicator
        label="Taxonomy version"
        version="2025-11-30"
        standing={VERSION_PIN_STANDING.SUPERSEDED}
        standingLabel="Superseded"
        note="A newer version of the standard has been adopted."
      />,
    );

    // The standing is carried by a border colour. A state a sighted reader can see and a screen
    // reader cannot is not a state (WCAG 1.4.1), so the text is what this asserts.
    expect(screen.getByText('Superseded')).toBeInTheDocument();
    expect(screen.getByText('A newer version of the standard has been adopted.')).toBeInTheDocument();
  });

  /**
   * **The other half of the same state.** A gate-integrity review deleted the superseded class from
   * the component and every check above stayed green — so the only signal a sighted reader gets
   * could be lost silently. The standing now rides a `data-standing` attribute the stylesheet keys
   * off, which gives it one source of truth and something a spec can read.
   */
  it('marks the standing on the element the stylesheet keys off', () => {
    const { rerender, container } = render(
      <VersionPinIndicator label="Taxonomy version" version="2026-05-01" />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-standing', 'in_force');

    rerender(
      <VersionPinIndicator
        label="Taxonomy version"
        version="2025-11-30"
        standing={VERSION_PIN_STANDING.SUPERSEDED}
        standingLabel="Superseded"
      />,
    );
    expect(container.firstElementChild).toHaveAttribute('data-standing', 'superseded');
  });
});
