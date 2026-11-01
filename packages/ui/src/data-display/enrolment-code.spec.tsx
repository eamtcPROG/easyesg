import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EnrolmentCode } from './enrolment-code';
import { EnrolmentCodeLoading } from './enrolment-code-loading';

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const URI = `otpauth://totp/EasyESG:ana%40example.md?issuer=EasyESG&secret=${SECRET}&algorithm=SHA1&digits=6&period=30`;

/**
 * Enrolment code's contract (task 143): its three arms, and the properties of the symbol that render
 * identically when broken.
 *
 * **What this file cannot prove is the property that matters most — that the squares encode the
 * URI.** jsdom lays nothing out and rasterises nothing, so no decoder can run here.
 * `e2e/web/support/symbol.ts` decodes the pixels S-28 actually draws and `second-factor.ts` enrols
 * with what it read: that is the proof. What this file pins is that the symbol is *drawn from* the
 * value it is given — the same URI draws the same modules and another account's draws different
 * ones — which fails on a constant symbol, and on one drawn from the secret rather than the URI.
 */
function renderCode({ uri, heading }: { readonly uri: string | null; readonly heading: string }) {
  return render(
    <EnrolmentCode
      uri={uri}
      secret={SECRET}
      heading={heading}
      help="Add it to your authenticator app."
      symbolLabel="QR code for your authenticator app"
    />,
  );
}

/**
 * The symbol draws two paths: its ground first, then the dark modules. Asserted rather than assumed,
 * so a library upgrade that draws a third cannot shift `[1]` onto the wrong path with the tests green.
 */
const pathsOf = (container: HTMLElement) => {
  const paths = container.querySelectorAll('svg path');
  expect(paths).toHaveLength(2);
  return paths;
};
const modulesOf = (container: HTMLElement) => pathsOf(container)[1]?.getAttribute('d') ?? null;

describe('EnrolmentCode (§11.5, task 143)', () => {
  it('draws the symbol beside the secret, and names the symbol for a screen reader', () => {
    renderCode({ uri: URI, heading: 'Scan or enter this code' });

    expect(screen.getByRole('img', { name: 'QR code for your authenticator app' })).toBeInTheDocument();
    expect(screen.getByText('Scan or enter this code')).toBeInTheDocument();
    expect(screen.getByText(SECRET)).toHaveAttribute('translate', 'no');
    expect(screen.getByText('Add it to your authenticator app.')).toBeInTheDocument();
  });

  it('draws its modules from the URI it is given', () => {
    const drawn = modulesOf(renderCode({ uri: URI, heading: 'first' }).container);
    const again = modulesOf(renderCode({ uri: URI, heading: 'again' }).container);
    // The same secret under another account: a symbol drawn from the secret alone would not change.
    const otherAccount = modulesOf(
      renderCode({ uri: URI.replace('ana%40', 'ion%40'), heading: 'other' }).container,
    );

    expect(drawn).toMatch(/^M/);
    expect(again).toBe(drawn);
    expect(otherAccount).not.toBe(drawn);
  });

  /**
   * ISO/IEC 18004's quiet zone, observed through the first finder pattern: seven dark modules across
   * the top-left corner, beginning four modules in. Drawn with no margin, the path starts at `M0 0`.
   */
  it('keeps four modules of quiet zone around the symbol', () => {
    expect(modulesOf(renderCode({ uri: URI, heading: 'zone' }).container)).toMatch(/^M4 4h7v1H4z/);
  });

  /**
   * The colours come from the stylesheet's two tokens, through `currentColor` and the plate behind a
   * transparent ground. The library's defaults are `#000000` on `#FFFFFF` — literals, which
   * `packages/ui/CLAUDE.md` keeps out of every file but `tokens.css`, and blind to the plate.
   */
  it('paints its modules in currentColor over a transparent ground', () => {
    const [ground, modules] = pathsOf(renderCode({ uri: URI, heading: 'colour' }).container);

    expect(ground).toHaveAttribute('fill', 'transparent');
    expect(modules).toHaveAttribute('fill', 'currentColor');
  });

  it('stands the secret and its instructions alone when the URI is absent', () => {
    const { container } = renderCode({ uri: null, heading: 'Enter this key' });

    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText('Enter this key')).toBeInTheDocument();
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(screen.getByText('Add it to your authenticator app.')).toBeInTheDocument();
  });
});

describe('EnrolmentCodeLoading (§11.5, task 143)', () => {
  it('names the wait once, and hides every bar from assistive technology', () => {
    const { container } = render(<EnrolmentCodeLoading label="Preparing your code" />);

    expect(screen.getByRole('status')).toHaveTextContent('Preparing your code');
    expect(container.querySelectorAll('[aria-hidden="true"]')).toHaveLength(3);
    expect(container.querySelector('svg')).toBeNull();
  });
});
