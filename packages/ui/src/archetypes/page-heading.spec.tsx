import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { PageHeading } from './page-heading';

/**
 * The heading with its way back (30 Sep 2026) — the page's one `<h1>` group, the arrow named for where it leads and
 * built with the injected link, the trail above both and outside the group.
 */
const Routed: NavLinkComponent = ({ href, children, ...rest }) => (
  <a href={`/ro${href}`} {...rest}>
    {children}
  </a>
);

describe('PageHeading', () => {
  it('is the title and its summary as one heading group, and nothing else, without a way back', () => {
    const { container } = render(<PageHeading title="Reporting periods" summary="A period is a year." />);

    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Reporting periods');
    expect(heading.closest('hgroup')).toHaveTextContent('A period is a year.');
    expect(screen.queryByRole('link')).toBeNull();
    // The group alone, as every `RecordShell` screen drew it before this component: no row around it.
    expect(container.firstElementChild?.tagName).toBe('HGROUP');
  });

  it('names the arrow for where it leads, builds it with the injected link, and puts it before the title', () => {
    render(
      <PageHeading title="Reporting periods" back={{ href: '/entities/e1', label: 'Back to OkFlora' }} linkComponent={Routed} />,
    );

    const back = screen.getByRole('link', { name: 'Back to OkFlora' });
    expect(back).toHaveAttribute('href', '/ro/entities/e1');
    expect(back.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The arrow is a sibling of the group, never inside it: a heading group holds a heading and its tagline only.
    expect(back.closest('hgroup')).toBeNull();
  });

  it('puts the trail above the title and outside the heading group', () => {
    render(<PageHeading title="Reporting periods" breadcrumb={<nav aria-label="Breadcrumb">trail</nav>} />);

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(trail.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trail.closest('hgroup')).toBeNull();
  });
});
