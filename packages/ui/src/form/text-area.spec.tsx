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
