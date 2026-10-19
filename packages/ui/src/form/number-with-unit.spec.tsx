import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberWithUnit } from './number-with-unit';
import { TextField } from './text-field';
import { UnitLabel } from './unit-label';

describe('NumberWithUnit (task 221; §11.5)', () => {
  it('draws the value beside a fixed unit, and the row names itself where it carries a label', () => {
    render(
      <NumberWithUnit label="Total energy consumed" unit={<UnitLabel>MWh</UnitLabel>}>
        <TextField label="Total energy consumed" labelHidden inputMode="decimal" defaultValue="1 240" />
      </NumberWithUnit>,
    );
    expect(screen.getByRole('group', { name: 'Total energy consumed' })).toContainElement(screen.getByText('MWh'));
    expect(screen.getByRole('textbox', { name: 'Total energy consumed' })).toHaveValue('1 240');
  });

  it('is no group where it carries no label — the disclosure field around it names the row', () => {
    render(
      <NumberWithUnit unit={<UnitLabel>t</UnitLabel>}>
        <TextField label="Waste" labelHidden inputMode="decimal" />
      </NumberWithUnit>,
    );
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.getByText('t')).toBeInTheDocument();
  });

  it('draws no unit box where the standard states no unit', () => {
    const { container } = render(
      <NumberWithUnit>
        <TextField label="Hours" labelHidden inputMode="decimal" />
      </NumberWithUnit>,
    );
    // The row holds the value's column alone.
    expect(container.querySelectorAll('[class*="unit"]')).toHaveLength(0);
  });
});
