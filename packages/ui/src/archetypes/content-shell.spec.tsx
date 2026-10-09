import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MAIN_CONTENT_ID } from '../navigation/skip-link-vocabulary';
import { ContentSection } from './content-section';
import { ContentShell } from './content-shell';
import { ContentWide } from './content-wide';

/**
 * The Content archetype's contract (§4.6; task 74.2): the landmark the skip link reaches, one page-level heading with
 * the set it belongs to and its lede grouped with it, and the text's sections a level beneath — the structure that
 * renders identically when wrong and is a WCAG 2.2 AA failure only a screen reader meets (NFR-75).
 */
describe('ContentShell', () => {
  const page = (props: Partial<Parameters<typeof ContentShell>[0]> = {}) =>
    render(
      <ContentShell eyebrow="Legal" title="Terms of service" lede="The agreement between your company and us." {...props}>
        <ContentSection id="who" heading="Who we are" number={1}>
          <p>We are a company.</p>
        </ContentSection>
        <ContentWide>
          <table>
            <tbody>
              <tr>
                <td>wide</td>
              </tr>
            </tbody>
          </table>
        </ContentWide>
      </ContentShell>,
    );

  it('is the page’s main landmark, which the skip link can move focus to', () => {
    page();
    const main = screen.getByRole('main');
    expect(main).toHaveAttribute('id', MAIN_CONTENT_ID);
    expect(main).toHaveAttribute('tabindex', '-1');
  });

  it('carries one page-level heading, grouped with the set it belongs to and its lede', () => {
    page();
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Terms of service');
    // An `hgroup`: a heading plus its taglines, where `header` would mean navigational aids.
    const group = title.closest('hgroup');
    expect(group).toHaveTextContent('Legal');
    expect(group).toHaveTextContent('The agreement between your company and us.');
    expect(screen.getAllByRole('heading').map((heading) => heading.tagName)).toEqual(['H1', 'H2']);
  });

  it('draws the page’s standing and its peers when given, and nothing in their place when not', () => {
    const { unmount } = page({ standing: <span>In force since 1 March 2026</span>, peers: <nav aria-label="Legal documents" /> });
    expect(screen.getByText('In force since 1 March 2026')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Legal documents' })).toBeInTheDocument();
    unmount();

    page();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('keeps the text’s frame where the text cannot be read, so the error stands where it would have', () => {
    render(
      <ContentShell title="Terms of service" peers={<nav aria-label="Legal documents" />}>
        <div role="alert">The text could not be loaded.</div>
      </ContentShell>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Terms of service');
    expect(screen.getByRole('navigation', { name: 'Legal documents' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('The text could not be loaded.');
  });
});

describe('ContentWide', () => {
  /** The wider measure is a custom property the shell's text reads, so it holds whatever order the stylesheets load in. */
  it('widens its block to the 100ch measure', () => {
    render(
      <ContentWide>
        <p>wide</p>
      </ContentWide>,
    );
    expect(screen.getByText('wide').parentElement).toHaveStyle({ '--content-measure': '100ch' });
  });
});
