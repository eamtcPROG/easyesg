import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContentSection } from './content-section';

/** One section of a Content page's text: a region named by its own `<h2>`, at the id its contents entry links to. */
describe('ContentSection', () => {
  it('is a region labelled by its own second-level heading, at the id the contents link to', () => {
    render(
      <ContentSection id="who" heading="Who we are">
        <p>We are a company.</p>
      </ContentSection>,
    );
    const region = screen.getByRole('region', { name: 'Who we are' });
    expect(region).toHaveAttribute('id', 'who');
    expect(screen.getByRole('heading', { level: 2, name: 'Who we are' })).toBeInTheDocument();
    expect(region).toHaveTextContent('We are a company.');
  });

  /** The legal set numbers its sections; the number is a visual index and the heading's name stays the words. */
  it('shows the section’s number beside its heading without making it part of the heading’s name', () => {
    render(
      <ContentSection id="who" heading="Who we are" number={1}>
        <p>We are a company.</p>
      </ContentSection>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Who we are' })).toBeInTheDocument();
    expect(screen.getByText('1')).toHaveAttribute('aria-hidden', 'true');
  });
});
