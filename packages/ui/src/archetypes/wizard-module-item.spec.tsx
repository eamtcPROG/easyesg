import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { WizardModuleItem } from './wizard-module-item';
import { WIZARD_STEP_STATE } from './wizard-step-vocabulary';

/**
 * The step row's own guarantees — task 106's for position, task 179.1's for state.
 *
 * **Position** is `aria-current="step"` on the anchor: an ancestor's is not announced to a reader moving link-to-link,
 * which is how anyone crosses the list. **State** is the anchor's description and never its name: a link called
 * *B1 — Basis for preparation In progress · 3 outstanding* is a different link every time a field is answered.
 */
describe('WizardModuleItem', () => {
  const item = (props: { current?: boolean } = {}) =>
    render(
      <ol>
        <WizardModuleItem
          href="/reports/r1/B1"
          label="B1 — Basis for preparation"
          state={WIZARD_STEP_STATE.IN_PROGRESS}
          status="In progress · 3 outstanding"
          {...props}
        />
      </ol>,
    );

  it('names the link by the step alone and says where it stands as its description', () => {
    item();

    const link = screen.getByRole('link', { name: 'B1 — Basis for preparation' });
    expect(link).toHaveAccessibleDescription('In progress · 3 outstanding');
  });

  it('draws the state in view and hides that copy, so a screen reader does not hear it twice', () => {
    item();

    const line = screen.getByText('In progress · 3 outstanding');
    expect(line).toBeVisible();
    expect(line).toHaveAttribute('aria-hidden', 'true');
  });

  it('puts aria-current on the anchor, not on the list item', () => {
    item({ current: true });

    const current = screen.getAllByRole('link', { current: 'step' });
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/reports/r1/B1');
    // Queried directly: there is no role-based way to ask for an absent attribute.
    expect(document.querySelectorAll('li[aria-current]')).toHaveLength(0);
  });

  it('marks nothing when the step is not current', () => {
    item();

    expect(screen.queryAllByRole('link', { current: 'step' })).toHaveLength(0);
  });

  it('carries its state for the mark to draw', () => {
    item();

    expect(screen.getByRole('listitem')).toHaveAttribute('data-state', WIZARD_STEP_STATE.IN_PROGRESS);
  });

  it('renders through an injected link component, passing the description on', () => {
    // Stands in for `apps/web`'s locale-aware link — the package holds no router, so the only way it can be wrong is
    // by not passing on what it promised.
    const Localized: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/ru${href}`} {...rest}>
        {children}
      </a>
    );

    render(
      <ol>
        <WizardModuleItem
          href="/reports/r1/B3"
          label="B3 — Energy and emissions"
          state={WIZARD_STEP_STATE.COMPLETE}
          status="Complete"
          current
          linkComponent={Localized}
        />
      </ol>,
    );

    const current = screen.getByRole('link', { current: 'step' });
    expect(current).toHaveAttribute('href', '/ru/reports/r1/B3');
    expect(current).toHaveAccessibleDescription('Complete');
  });
});
