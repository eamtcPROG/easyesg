import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination, type PaginationProps } from './pagination';

/**
 * The pager's numbered pages and its size choice (task 170). The window of numbers it draws is
 * `pagination-window.spec.ts`'s; this file pins what reaches the reader and the caller.
 */
const LABELS: PaginationProps['labels'] = {
  region: 'Pagination',
  previous: 'Previous',
  next: 'Next',
  position: (of) => `${of.from}–${of.to} of ${of.total}`,
  page: (page) => `Page ${page}`,
};

const SIZES = { options: [25, 50, 100], label: 'Rows per page' };

describe('Pagination', () => {
  it('numbers its pages and marks the current one', () => {
    render(<Pagination page={2} pageSize={25} total={60} onPageChange={() => undefined} labels={LABELS} />);

    const pages = within(screen.getByRole('list')).getAllByRole('button');
    expect(pages.map((page) => page.textContent)).toEqual(['1', '2', '3']);
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Page 1' })).not.toHaveAttribute('aria-current');
  });

  it('reports the page a number was pressed for', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={25} total={60} onPageChange={onPageChange} labels={LABELS} />);

    await userEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('renders nothing for a single page when it offers no size', () => {
    render(<Pagination page={1} pageSize={25} total={11} onPageChange={() => undefined} labels={LABELS} />);
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  /** The reader who chose 100 must be able to choose 25 again once everything fits one page. */
  it('stays for a single page when it offers a size, with no page controls', () => {
    render(
      <Pagination
        page={1}
        pageSize={25}
        total={11}
        onPageChange={() => undefined}
        sizes={{ ...SIZES, onChange: () => undefined }}
        labels={LABELS}
      />,
    );

    expect(screen.getByRole('navigation', { name: 'Pagination' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1–11 of 11');
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveTextContent('25');
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument();
  });
});
