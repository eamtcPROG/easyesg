import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CredentialSubmit } from './credential-submit';

/**
 * Task 153's mechanism (§12.5.6's task-153 row): the submit is disabled in the HTML the server sends — which is what
 * a browser shows before hydration, and what it keeps with scripting off — and enabled once the browser renders.
 */
describe('CredentialSubmit', () => {
  it('is disabled in the server’s HTML, so Enter before hydration submits nothing', () => {
    const html = renderToString(<CredentialSubmit busy={false}>Intrați în cont</CredentialSubmit>);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled=""/u);
  });

  it('is enabled once the browser renders it', () => {
    render(<CredentialSubmit busy={false}>Intrați în cont</CredentialSubmit>);
    expect(screen.getByRole('button', { name: 'Intrați în cont' })).toBeEnabled();
  });

  it('stays unavailable while its action runs', () => {
    render(<CredentialSubmit busy>Intrați în cont</CredentialSubmit>);
    expect(screen.getByRole('button', { name: 'Intrați în cont' })).toBeDisabled();
  });
});
