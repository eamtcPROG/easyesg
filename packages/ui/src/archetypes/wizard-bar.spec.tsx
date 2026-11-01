import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { WizardBar } from './wizard-bar';

describe('WizardBar', () => {
  const back = { href: '/reports', label: 'Leave the report — your work is saved' };

  it('offers the way out as the arrow, named by the caller’s sentence', () => {
    render(<WizardBar back={back} title="VSME 2025 — Basic Module" />);

    // UX-5: the one explicitly labelled way out, stating that the work is saved.
    expect(screen.getByRole('link', { name: 'Leave the report — your work is saved' })).toHaveAttribute(
      'href',
      '/reports',
    );
  });

  it('names the report without taking the step’s heading', () => {
    render(<WizardBar back={back} title="VSME 2025 — Basic Module" meta="Brutăria Lina SRL · In progress" />);

    expect(screen.getByText('VSME 2025 — Basic Module')).toBeVisible();
    expect(screen.getByText('Brutăria Lina SRL · In progress')).toBeVisible();
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('draws the save state and both sets of actions where the caller gives them', () => {
    render(
      <WizardBar
        back={back}
        title="VSME 2025 — Basic Module"
        saveState={<p role="status">Saved</p>}
        actions={<button type="button">Export</button>}
        overflow={<button type="button">More actions</button>}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('leaves through the injected link, so a guard on leaving is the app’s', () => {
    const Guarded: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={href} data-guarded="true" {...rest}>
        {children}
      </a>
    );

    render(<WizardBar back={back} linkComponent={Guarded} title="VSME 2025 — Basic Module" />);

    expect(screen.getByRole('link', { name: back.label })).toHaveAttribute('data-guarded', 'true');
  });
});
