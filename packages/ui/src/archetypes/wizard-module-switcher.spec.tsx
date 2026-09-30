import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WIZARD_STEP_STATE } from './wizard-step-vocabulary';
import { WizardModuleSwitcher, type WizardSwitcherStep } from './wizard-module-switcher';

const step = (reference: string, name: string): WizardSwitcherStep => ({
  key: reference,
  href: `/reports/r1/${reference}`,
  reference,
  label: `${reference} — ${name}`,
  name,
  state: WIZARD_STEP_STATE.NOT_STARTED,
  status: 'Not started',
});

const STEPS = [
  step('B1', 'Basis for preparation'),
  step('B2', 'Practices and policies'),
  step('B3', 'Energy and emissions'),
  step('B4', 'Pollution'),
];

const switcher = (currentKey = 'B1') =>
  render(
    <WizardModuleSwitcher
      steps={STEPS}
      currentKey={currentKey}
      listLabel="Report sections"
      allLabel="All modules"
      moreLabel={(hidden) => `${hidden} more modules`}
      position="B1 · 1 of 4"
      closeLabel="Close the module list"
      stripSize={3}
    >
      <ol aria-label="Basic Module">
        {STEPS.map((s) => (
          <li key={s.key}>
            <a href={s.href}>{s.label}</a>
          </li>
        ))}
      </ol>
    </WizardModuleSwitcher>,
  );

describe('WizardModuleSwitcher', () => {
  it('names each chip by the step it opens, the reference it shows at the start of that name', () => {
    switcher();

    const strip = screen.getByRole('navigation', { name: 'Report sections' });
    // WCAG 2.5.3: the visible reference begins the name, and the name says what the step is.
    expect(within(strip).getByRole('link', { name: 'B1 — Basis for preparation' })).toHaveAccessibleDescription(
      'Not started',
    );
  });

  it('marks the current chip as the step, and shows no more chips than it has room for', () => {
    switcher('B2');

    const strip = screen.getByRole('navigation', { name: 'Report sections' });
    expect(within(strip).getAllByRole('link')).toHaveLength(3);
    expect(within(strip).getByRole('link', { current: 'step' })).toHaveAccessibleName('B2 — Practices and policies');
  });

  it('names the current step and its place for the stepper', () => {
    switcher();

    expect(screen.getByText('B1 · 1 of 4')).toBeInTheDocument();
    expect(screen.getByText('Basis for preparation')).toBeInTheDocument();
  });

  it('opens the whole list from the +n, and closes it when a step is chosen', async () => {
    const user = userEvent.setup();
    switcher();

    await user.click(screen.getByRole('button', { name: '1 more modules' }));

    const drawer = screen.getByRole('dialog', { name: 'All modules' });
    const list = within(drawer).getByRole('navigation', { name: 'Report sections' });
    expect(within(list).getAllByRole('link')).toHaveLength(4);

    await user.click(within(list).getByRole('link', { name: 'B4 — Pollution' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the same list from All modules, and closes it by its own control', async () => {
    const user = userEvent.setup();
    switcher();

    await user.click(screen.getByRole('button', { name: 'All modules' }));
    expect(screen.getByRole('dialog', { name: 'All modules' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close the module list' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
