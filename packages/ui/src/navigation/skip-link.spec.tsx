import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkipLink } from './skip-link';
import { MAIN_CONTENT_ID } from './skip-link-vocabulary';

describe('SkipLink (task 203.3, UX-99)', () => {
  it('targets the id every main carries, in the caller’s words', () => {
    render(<SkipLink label="Treceți la conținut" />);
    expect(screen.getByRole('link', { name: 'Treceți la conținut' })).toHaveAttribute('href', `#${MAIN_CONTENT_ID}`);
  });
});
