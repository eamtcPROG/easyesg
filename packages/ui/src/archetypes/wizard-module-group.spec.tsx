import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WizardModuleGroup } from './wizard-module-group';
import { WIZARD_STEP_STATE } from './wizard-step-vocabulary';

describe('WizardModuleGroup', () => {
  const segments = [
    { key: 'B1', state: WIZARD_STEP_STATE.IN_PROGRESS },
    { key: 'B2', state: WIZARD_STEP_STATE.COMPLETE },
    { key: 'B6', state: WIZARD_STEP_STATE.OMITTED },
  ];

  it('labels its list by the group’s name, rather than heading it above the page’s one h1', () => {
    render(
      <WizardModuleGroup name="Basic Module" count="1 of 2 done" segments={segments} note="B6 is not counted.">
        <li>B1</li>
      </WizardModuleGroup>,
    );

    expect(screen.getByRole('list', { name: 'Basic Module' })).toBeInTheDocument();
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('1 of 2 done')).toBeVisible();
    expect(screen.getByText('B6 is not counted.')).toBeVisible();
  });

  it('draws one segment per step, in their order, hidden from assistive technology', () => {
    const { container } = render(
      <WizardModuleGroup name="Basic Module" count="1 of 2 done" segments={segments}>
        <li>B1</li>
      </WizardModuleGroup>,
    );

    const drawn = container.querySelectorAll('[data-state]');
    expect([...drawn].map((segment) => segment.getAttribute('data-state'))).toEqual([
      WIZARD_STEP_STATE.IN_PROGRESS,
      WIZARD_STEP_STATE.COMPLETE,
      WIZARD_STEP_STATE.OMITTED,
    ]);
    expect(drawn[0]?.parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  it('draws no note when nothing is discounted or waiting', () => {
    const { container } = render(
      <WizardModuleGroup name="Basic Module" count="0 of 1 done" segments={segments.slice(0, 1)}>
        <li>B1</li>
      </WizardModuleGroup>,
    );

    // The heading line and nothing else: the roll-up holds one paragraph where a note would make two.
    expect(container.querySelectorAll('p')).toHaveLength(1);
  });
});
