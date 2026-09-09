import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WizardShell } from './wizard-shell';

/**
 * The Wizard archetype's landmark structure (§4.6: S-07 … S-12; UX-99, NFR-75).
 *
 * **Written because the archetype shipped without a `main`** and nothing could see it. The shell
 * had `<div className={styles.main}>` — a class name that reads like a landmark and is not one —
 * beside the module rail's `<nav>`, and nothing above it in `apps/web` supplies one: the `(app)`
 * layout renders the global tier and its children, and the `(wizard)` layout is providers only. So
 * every wizard screen had chrome to skip and nothing to skip *to*.
 *
 * It was invisible to every gate. `e2e/web/accessibility.spec.ts` scans with WCAG tags and
 * `landmark-one-main` is axe's **best-practice** set; no wizard screen was in its list in any case;
 * and this file did not exist, `index-shell` and `record-shell` being the only archetypes with one.
 *
 * These assertions are the two halves of the rule rather than one: the landmark is **there**, and
 * the rail is **outside** it. A `main` wrapping the whole shell would satisfy the first and defeat
 * the point — a screen reader would find a landmark whose first content is the navigation it wanted
 * to skip past, which is task 30.1's reason for putting `(workspace)`'s `<main>` around only its
 * children.
 */
describe('WizardShell', () => {
  const shell = () =>
    render(
      <WizardShell
        modules={<li>B1</li>}
        modulesLabel="Report sections"
        title="B2 — Practices"
        exit={<a href="/reports">Exit</a>}
      >
        <p>step content</p>
      </WizardShell>,
    );

  it('renders the step as a main landmark', () => {
    shell();

    expect(screen.getByRole('main')).toHaveTextContent('step content');
  });

  it('keeps the module rail outside it, so there is something to skip to', () => {
    shell();

    const rail = screen.getByRole('navigation', { name: 'Report sections' });
    expect(rail).toBeInTheDocument();
    expect(within(screen.getByRole('main')).queryByRole('navigation')).toBeNull();
  });

  it('is exactly one landmark, not one per region', () => {
    shell();

    // The opposite sign of the same defect, and the likelier regression: `IndexShell` and
    // `RecordShell` render inside a `(workspace)` layout that already supplies a `main`, so a
    // well-meaning sweep that gave every archetype one would double it there.
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
});
