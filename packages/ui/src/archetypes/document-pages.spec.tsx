import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DocumentPages } from './document-pages';

/** The pages a document forces, each a link into the frame that shows it (§4.6; task 43.2). */
describe('DocumentPages', () => {
  const PAGES = [
    { id: 'cover', label: 'Cover' },
    { id: 'B3', label: 'Energy and emissions', reference: 'B3' },
  ];

  it('names the list and opens each page in the frame by its anchor', () => {
    render(<DocumentPages label="Pages of the document" document="/doc?locale=en" frame="report-document" pages={PAGES} />);
    const nav = screen.getByRole('navigation', { name: 'Pages of the document' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((link) => [link.getAttribute('href'), link.getAttribute('target')])).toEqual([
      ['/doc?locale=en#cover', 'report-document'],
      ['/doc?locale=en#B3', 'report-document'],
    ]);
  });

  it('shows a module’s reference beside its name without making it part of the link’s name', () => {
    render(<DocumentPages label="Pages" document="/doc" frame="f" pages={PAGES} />);
    expect(screen.getByRole('link', { name: 'Energy and emissions' })).toBeInTheDocument();
    expect(screen.getByText('B3')).toHaveAttribute('aria-hidden', 'true');
  });
});
