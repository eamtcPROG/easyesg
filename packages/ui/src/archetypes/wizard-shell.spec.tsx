import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WizardShell } from './wizard-shell';

/**
 * The Wizard archetype's landmark structure (§4.6: S-07 … S-12; UX-99, NFR-75).
 *
 * **Written because the archetype shipped without a `main`** and nothing could see it: a `<div>` whose class read like
 * a landmark, and nothing above it in `apps/web` supplying one, so every wizard screen had chrome to skip and nothing to
 * skip *to*. `accessibility.spec.ts` could not have caught it — `landmark-one-main` is axe's best-practice set.
 *
 * These assertions are the halves of the rule rather than one: the landmark is **there**, and the rail, the bar and the
 * list below `wide` are **outside** it. A `main` wrapping the whole shell would satisfy the first and defeat the point —
 * a screen reader would find a landmark whose first content is the chrome it wanted to skip. Task 179.1 added the bar and
 * the compact list, which is why they are asserted here too.
 */
describe('WizardShell', () => {
  const shell = () =>
    render(
      <WizardShell
        bar={<a href="/reports">Leave the report</a>}
        modules={<ol aria-label="Basic Module" />}
        modulesLabel="Report sections"
        compactModules={<button type="button">All modules</button>}
        title="B2 — Practices and policies"
        progress="One field left"
      >
        <p>step content</p>
      </WizardShell>,
    );

  it('renders the step as a main landmark, headed by the step', () => {
    shell();

    const main = screen.getByRole('main');
    expect(main).toHaveTextContent('step content');
    expect(within(main).getByRole('heading', { level: 1 })).toHaveTextContent('B2 — Practices and policies');
  });

  it('keeps the module list, the bar and the list below wide outside it, so there is something to skip to', () => {
    shell();

    expect(screen.getByRole('navigation', { name: 'Report sections' })).toBeInTheDocument();
    const main = screen.getByRole('main');
    expect(within(main).queryByRole('navigation')).toBeNull();
    expect(within(main).queryByRole('link', { name: 'Leave the report' })).toBeNull();
    expect(within(main).queryByRole('button', { name: 'All modules' })).toBeNull();
  });

  it('is exactly one landmark, not one per region', () => {
    shell();

    // The opposite sign of the same defect, and the likelier regression: `IndexShell` and `RecordShell` render inside
    // a `(workspace)` layout that already supplies a `main`, so a sweep that gave every archetype one would double it.
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });

  it('draws no compact slot when the caller has no list for the narrower frames', () => {
    render(
      <WizardShell bar={<span>bar</span>} modules={null} modulesLabel="Report sections" title="B1">
        <p>step content</p>
      </WizardShell>,
    );

    expect(screen.queryByRole('button', { name: 'All modules' })).toBeNull();
  });
});
