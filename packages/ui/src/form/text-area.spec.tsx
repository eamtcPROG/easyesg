import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextArea } from './text-area';

describe('TextArea (§11.5 form control)', () => {
  it('is labelled, described by its help, and keeps paragraph breaks', () => {
    render(
      <TextArea label="Description" help="One or two paragraphs." defaultValue={'One.\n\nTwo.'} />,
    );

    const control = screen.getByLabelText('Description');
    expect(control.tagName).toBe('TEXTAREA');
    expect(control).toHaveAccessibleDescription('One or two paragraphs.');
    expect(control).toHaveValue('One.\n\nTwo.');
  });

  it('marks itself invalid and associates the message when an error is given', () => {
    render(<TextArea label="Description" error="Too long. It will not be saved. Shorten it." />);

    const control = screen.getByLabelText('Description');
    expect(control).toHaveAttribute('aria-invalid', 'true');
    expect(control).toHaveAccessibleDescription('Too long. It will not be saved. Shorten it.');
  });
});

/**
 * UX-19's length indication (task 36.2) — described, never announced.
 *
 * The soft target that requirement also asks for is deferred: no reference corpus exists in this
 * repository, and `architecture.md` §12.5.6 records what is assumed meanwhile. What is testable
 * today is that the count reaches the control's description, since a count a screen reader cannot
 * reach is a count only sighted users have.
 */
describe('TextArea’s length indication (UX-19)', () => {
  it('describes the control with the count, alongside help rather than instead of it', () => {
    render(<TextArea label="Certifications" help="Name the issuer and the date." count="128 characters" />);

    const control = screen.getByRole('textbox', { name: 'Certifications' });
    const described = (control.getAttribute('aria-describedby') ?? '').split(' ');
    expect(described.length).toBe(2);
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'Name the issuer and the date.',
      '128 characters',
    ]);
  });

  it('is not a live region: a count updating per keystroke must not talk over the typing', () => {
    render(<TextArea label="Certifications" count="9 characters" />);

    const count = screen.getByText('9 characters');
    expect(count).not.toHaveAttribute('aria-live');
    expect(count.closest('[aria-live]')).toBeNull();
  });

  it('renders no count node at all when the caller passes none', () => {
    render(<TextArea label="Certifications" help="Only help." />);

    const control = screen.getByRole('textbox', { name: 'Certifications' });
    expect((control.getAttribute('aria-describedby') ?? '').split(' ')).toHaveLength(1);
  });
});
