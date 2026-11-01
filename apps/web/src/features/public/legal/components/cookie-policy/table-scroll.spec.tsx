import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { TableScroll } from './table-scroll';

/**
 * The cookie table's card, which scrolls sideways inside itself where the columns cannot fit, and only then is a named
 * region a keyboard can reach. jsdom lays nothing out, so each case states the card's widths.
 */
describe('TableScroll', () => {
  /** jsdom has no `ResizeObserver`; this one keeps the callback, so a case can resize the card. */
  let resized: () => void = () => undefined;

  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          resized = callback;
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const widths = ({ content, frame }: { content: number; frame: number }) => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(content);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(frame);
  };

  const card = () =>
    render(
      <TableScroll className="frame" labelledBy="caption">
        <table>
          <caption id="caption">Cookies</caption>
          <tbody>
            <tr>
              <td>easyesg_session</td>
            </tr>
          </tbody>
        </table>
      </TableScroll>,
    );

  it('is a region named by the table’s caption, reachable by Tab, while the table is wider than the card', () => {
    widths({ content: 340, frame: 286 });
    card();
    const region = screen.getByRole('region', { name: 'Cookies' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveClass('frame');
  });

  it('is neither a region nor a tab stop while the table fits', () => {
    widths({ content: 286, frame: 286 });
    card();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('table').parentElement).not.toHaveAttribute('tabindex');
  });

  it('measures again when the card is resized', () => {
    widths({ content: 286, frame: 286 });
    card();
    expect(screen.queryByRole('region')).toBeNull();

    widths({ content: 340, frame: 286 });
    act(() => resized());
    expect(screen.getByRole('region', { name: 'Cookies' })).toHaveAttribute('tabindex', '0');
  });
});
