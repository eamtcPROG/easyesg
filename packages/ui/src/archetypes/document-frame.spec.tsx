import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DocumentFrame } from './document-frame';

/** The frame a rendered document is shown in (§4.6; task 43.2) — admitting no script, and saying it is assembling. */
describe('DocumentFrame', () => {
  const frame = () =>
    render(<DocumentFrame src="/doc?locale=en" name="report-document" title="The report as its document" pending="Assembling…" />);

  it('shows the document in a frame that runs no script, named so links can open a page in it', () => {
    frame();
    const document = screen.getByTitle('The report as its document');
    expect(document.tagName).toBe('IFRAME');
    expect(document).toHaveAttribute('src', '/doc?locale=en');
    expect(document).toHaveAttribute('name', 'report-document');
    // Same origin so the page list's anchors move it, and nothing else: no script, no form, no top navigation.
    expect(document).toHaveAttribute('sandbox', 'allow-same-origin');
  });

  it('says the document is being assembled until the frame has loaded it', () => {
    frame();
    expect(screen.getByRole('status')).toHaveTextContent('Assembling…');
    fireEvent.load(screen.getByTitle('The report as its document'));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
