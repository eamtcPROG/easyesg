import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OverflowMenu } from './overflow-menu';

/**
 * The overflow menu's rules (task 170): named for its row, empty renders nothing, a destructive item
 * set apart below the others, and choosing an item reports it.
 */
describe('OverflowMenu', () => {
  it('renders nothing when the row has no actions', () => {
    const { container } = render(<OverflowMenu label="More actions for Google" items={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('places a destructive item last, whatever order it was given in', async () => {
    render(
      <OverflowMenu
        label="More actions for ana@easyesg.md"
        items={[
          { key: 'remove', label: 'Remove access…', destructive: true, onSelect: () => undefined },
          { key: 'suspend', label: 'Suspend…', onSelect: () => undefined },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More actions for ana@easyesg.md' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((item) => item.textContent)).toEqual(['Suspend…', 'Remove access…']);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('reports the item chosen, and not a disabled one', async () => {
    const onEnable = vi.fn();
    const onDisable = vi.fn();
    render(
      <OverflowMenu
        label="More actions for Google"
        items={[
          { key: 'enable', label: 'Enable', onSelect: onEnable },
          { key: 'disable', label: 'Disable…', onSelect: onDisable, disabled: true },
        ]}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'More actions for Google' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Disable…' }));
    expect(onDisable).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Enable' }));
    expect(onEnable).toHaveBeenCalledOnce();
  });
});
