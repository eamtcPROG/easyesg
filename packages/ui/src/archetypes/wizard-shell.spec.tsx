import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WizardModuleItem, WizardShell } from './wizard-shell';
import type { NavLinkComponent } from '../navigation/nav-link';

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

/**
 * The rail item's own guarantees (task 106) — the wizard's half of task 105's lesson.
 *
 * **These could not be written before the API change.** The anchor arrived as `children`, so the
 * component could assert nothing about the interactive element and `aria-current="step"` sat on the
 * `<li>`. A `listitem` is at least in the accessibility tree, which made this less broken than the
 * workspace tier's `<span>` and no less silent where it counts: moving link-to-link is how a reader
 * crosses eleven modules, and an ancestor's `aria-current` is not announced there.
 */
describe('WizardModuleItem', () => {
  it('puts aria-current on the anchor, not on the list item', () => {
    render(
      <ol>
        <WizardModuleItem href="/reports/r1/B1" label="B1" />
        <WizardModuleItem href="/reports/r1/B2" label="B2" current />
      </ol>,
    );

    // The assertion the docblock's WCAG claim rests on. A `{ current: 'step' }` query on role
    // `link` matches the anchor and nothing else, so it fails if the attribute drifts back onto an
    // ancestor — which is exactly the regression this component shipped with.
    const current = screen.getAllByRole('link', { current: 'step' });

    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent('B2');
    expect(current[0]).toHaveAttribute('href', '/reports/r1/B2');
    // And it is NOT on the ancestor. Queried directly, because there is no role-based way to ask
    // for an absent attribute — and written as an assertion rather than as
    // `expect(...).toBeUndefined` without the call, which is the no-op the first draft of this
    // line shipped: it asserted nothing and passed.
    expect(document.querySelectorAll('li[aria-current]')).toHaveLength(0);
  });

  it('marks nothing when no module is current', () => {
    render(
      <ol>
        <WizardModuleItem href="/reports/r1/B1" label="B1" />
      </ol>,
    );

    expect(screen.queryAllByRole('link', { current: 'step' })).toHaveLength(0);
  });

  it('renders the indicator beside the link rather than inside it', () => {
    render(
      <ol>
        <WizardModuleItem href="/reports/r1/B1" label="B1" indicator={<span>3 of 7</span>} />
      </ol>,
    );

    // UX-5 puts the per-module state next to the step, not in its accessible name: a link called
    // "B1 3 of 7" is a different link every time a field is answered.
    expect(screen.getByRole('link', { name: 'B1' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('3 of 7');
  });

  it('renders through an injected link component', () => {
    // Stands in for `apps/web`'s locale-aware `Link` — the package holds no router, so the only
    // way it can be wrong is by not passing on what it promised.
    const Localized: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/ru${href}`} {...rest}>
        {children}
      </a>
    );

    render(
      <ol>
        <WizardModuleItem
          href="/reports/r1/B3"
          label="B3"
          current
          linkComponent={Localized}
        />
      </ol>,
    );

    const current = screen.getByRole('link', { current: 'step' });
    expect(current).toHaveAttribute('href', '/ru/reports/r1/B3');
  });
});
