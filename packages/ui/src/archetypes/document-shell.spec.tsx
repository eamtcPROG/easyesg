import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DocumentShell } from './document-shell';

/** The Document archetype's frame (§4.6; task 43.2): the bar, the document's pages, and the document — one `<main>`. */
describe('DocumentShell', () => {
  it('holds the heading, the page list and the document in the one main landmark, beneath the bar', () => {
    render(
      <DocumentShell
        bar={<header>The bar</header>}
        heading={<h1>Report preview</h1>}
        pages={<nav aria-label="Pages">The pages</nav>}
      >
        <p>The document</p>
      </DocumentShell>,
    );
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', 'main-content');
    expect(within(main).getByRole('heading', { level: 1, name: 'Report preview' })).toBeInTheDocument();
    expect(within(main).getByRole('navigation', { name: 'Pages' })).toBeInTheDocument();
    expect(within(main).getByText('The document')).toBeInTheDocument();
    expect(within(main).queryByText('The bar')).toBeNull();
  });
});
