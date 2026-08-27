import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecordSection, RecordShell } from './record-shell';

/**
 * The Record archetype's contract, and it is almost entirely the heading structure — which is what
 * the archetype exists to carry across its six screens (§4.6: S-13, S-14, S-15, S-23, S-27, S-28).
 *
 * These are the assertions that fail on a screen which looks perfectly correct: a section labelled
 * by a heading it is not associated with, or a heading level that skips. Both render identically
 * and both are WCAG 2.2 AA failures (NFR-75), visible only to a screen reader.
 */
describe('RecordShell', () => {
  const shell = (props: Partial<Parameters<typeof RecordShell>[0]> = {}) =>
    render(
      <RecordShell title="Credentials" {...props}>
        <RecordSection id="password" heading="Password">
          <p>body</p>
        </RecordSection>
        <RecordSection id="factor" heading="Second factor" description="Extra protection.">
          <p>body</p>
        </RecordSection>
      </RecordShell>,
    );

  it('is one page-level heading with a heading per section beneath it', () => {
    shell();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Credentials');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Password',
      'Second factor',
    ]);
    // No level is skipped and none is the caller's to choose — the whole reason the levels live
    // in the archetype rather than in six screens.
    expect(screen.queryByRole('heading', { level: 3 })).toBeNull();
  });

  it('labels each section region by its own heading', () => {
    shell();

    // `getByRole('region', { name })` only finds it if `aria-labelledby` actually resolves — the
    // failure this pins is a section whose heading is present but not associated with it.
    expect(screen.getByRole('region', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Second factor' })).toBeInTheDocument();
  });

  it('gives each section the caller’s id, so anything can link to it', () => {
    shell();
    // S-01's refusal routes the reader to S-28's security settings; a generated id could not be
    // the target of an anchor written on another screen.
    expect(document.getElementById('password')).toHaveAttribute('id', 'password');
  });

  it('omits the record-level action bar when a Record commits per section', () => {
    // S-28's shape: six independent actions and no single save. A fixture here would render an
    // empty bar, or take a boolean to suppress it — the smell UX-89 names.
    const { container } = shell();
    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  it('renders record-level actions and attribution when a Record has them', () => {
    // S-15's shape, which is what §4.6 actually describes: grouped fields with one explicit save.
    shell({
      actions: <button type="button">Save</button>,
      attribution: 'Last changed by Ana Popescu on 12 August 2026.',
    });

    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByText(/Last changed by Ana Popescu/)).toBeInTheDocument();
  });

  it('renders a section’s own action beside its own fields', () => {
    render(
      <RecordShell title="Credentials">
        <RecordSection id="password" heading="Password" action={<button type="button">Change</button>}>
          <p>body</p>
        </RecordSection>
      </RecordShell>,
    );

    // Inside the region it belongs to, not floating at the record's foot — which is what makes a
    // six-action settings screen legible rather than a list of unattributed buttons.
    const region = screen.getByRole('region', { name: 'Password' });
    expect(region).toContainElement(screen.getByRole('button', { name: 'Change' }));
  });
});
