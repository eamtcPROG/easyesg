import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { NavLinkComponent } from '../navigation/nav-link';
import { RecordCard } from './record-card';
import { RecordSection } from './record-shell';

/**
 * The card form's contract (28 Sep 2026): the Record's heading structure, kept; the way back, named; and where each
 * slot lands — the commit inside the surface, the side column outside it.
 */
const card = (props: Partial<Parameters<typeof RecordCard>[0]> = {}) =>
  render(
    <RecordCard title="Brutăria Lina SRL" {...props}>
      <RecordSection id="identity" heading="Identity">
        <p>body</p>
      </RecordSection>
      <RecordSection id="sites" heading="Sites">
        <p>body</p>
      </RecordSection>
    </RecordCard>,
  );

describe('RecordCard', () => {
  it('keeps the Record’s one page heading and a labelled region per section', () => {
    card();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Brutăria Lina SRL');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual(['Identity', 'Sites']);
    expect(screen.getByRole('region', { name: 'Sites' })).toBeInTheDocument();
  });

  it('names the arrow for where it leads, and builds it with the injected link', () => {
    const Routed: NavLinkComponent = ({ href, children, ...rest }) => (
      <a href={`/ro${href}`} {...rest}>
        {children}
      </a>
    );

    card({ back: { href: '/entities', label: 'Back to reporting entities' }, linkComponent: Routed });

    const back = screen.getByRole('link', { name: 'Back to reporting entities' });
    expect(back).toHaveAttribute('href', '/ro/entities');
    // Before the title, so a reader meets the way out before the record.
    expect(back.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws no arrow without a way back', () => {
    card();

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('puts the trail above the title and outside the heading group', () => {
    card({ breadcrumb: <nav aria-label="Breadcrumb">trail</nav> });

    const trail = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(trail.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(trail.closest('hgroup')).toBeNull();
  });

  it('holds the commit inside the surface with the sections, and the side column outside it', () => {
    card({ actions: <button type="submit">Save</button>, aside: <p>Archive, never delete</p> });

    const sections = screen.getByRole('region', { name: 'Identity' }).parentElement;
    const save = screen.getByRole('button', { name: 'Save' });
    const aside = screen.getByText('Archive, never delete');
    expect(sections?.parentElement?.contains(save)).toBe(true);
    expect(sections?.parentElement?.contains(aside)).toBe(false);
  });
});
