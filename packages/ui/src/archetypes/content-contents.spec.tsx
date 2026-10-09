import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ContentContents } from './content-contents';

/**
 * A Content page's *On this page* list (§4.6; `design_spec.md` §4.6, resolved 9 Oct 2026): docked beside the text at
 * `wide`, a closed disclosure above it below. Both forms are in the DOM and a media query shows one, so each is held
 * here — jsdom applies no media query, which is also why the spec can see both.
 */
describe('ContentContents', () => {
  const SECTIONS = [
    { id: 'who', label: 'Who we are' },
    { id: 'service', label: 'What the service does' },
    { id: 'law', label: 'Law and disputes' },
  ];

  const contents = () => render(<ContentContents label="On this page" sections={SECTIONS} />);

  it('names both forms of the list as the page’s contents', () => {
    contents();
    expect(screen.getAllByRole('navigation', { name: 'On this page' })).toHaveLength(2);
  });

  it('links every section by its id, in order, each named by the section’s own words', () => {
    contents();
    for (const nav of screen.getAllByRole('navigation', { name: 'On this page' })) {
      const links = within(nav).getAllByRole('link');
      expect(links.map((link) => link.getAttribute('href'))).toEqual(['#who', '#service', '#law']);
      // The number is a visual index; a link's name is what the section is about.
      expect(links.map((link) => link.textContent?.replace(/^\d+/u, ''))).toEqual(SECTIONS.map((section) => section.label));
      expect(links.map((link) => within(link).getByText(/^\d+$/u).getAttribute('aria-hidden'))).toEqual([
        'true',
        'true',
        'true',
      ]);
    }
  });

  it('closes the disclosure until the reader opens it, its summary naming what it holds', () => {
    contents();
    const disclosure = screen.getByText('On this page', { selector: 'summary' }).closest('details');
    expect(disclosure).not.toBeNull();
    expect(disclosure).not.toHaveAttribute('open');
    expect(within(disclosure as HTMLElement).getByRole('navigation', { name: 'On this page' })).toBeInTheDocument();
  });
});
