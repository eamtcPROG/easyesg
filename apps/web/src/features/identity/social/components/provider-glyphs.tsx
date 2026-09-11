import type { ReactNode } from 'react';
import type { SocialProvider } from '@easyesg/contracts';
/**
 * The provider marks S-01's `ProviderButton`s carry (task 24). Content, not components: no
 * state, no text, sized by the button's glyph slot. Both are the providers' own sign-in marks
 * used for their sanctioned purpose — identifying the sign-in option — with their brand colors
 * literal, since a brand mark recolored by our theme would misidentify the provider.
 */
export function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function MicrosoftGlyph() {
  return (
    <svg viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

/**
 * The provider's mark, by provider (task 27.7).
 *
 * It lived as a private `GLYPHS` map inside `social-providers.tsx` until S-28 became a second
 * consumer — which is the smell CLAUDE.md names: a helper whose body mentions an imported
 * vocabulary and nothing else local is a missing export from the vocabulary's own module. Here
 * that module is this one, because the glyphs are what it holds.
 *
 * `Record<SocialProvider, …>` so adding a provider to the vocabulary without a mark is a compile
 * error rather than a blank square at render.
 *
 * **The parameter is `SocialProvider`, not `string`** (tightened 27 Aug 2026). It took a `string`
 * and narrowed with `isSocialProvider`, which quietly defeated the sentence above: a provider added
 * to the vocabulary with no mark here would have compiled and answered `null` at render, exactly
 * the blank square the `Record` was chosen to prevent. Every caller reads from the contract's own
 * enum, so nothing was buying the widening.
 */
const GLYPHS: Record<SocialProvider, ReactNode> = {
  google: <GoogleGlyph />,
  microsoft: <MicrosoftGlyph />,
};

export const providerGlyph = (provider: SocialProvider): ReactNode => GLYPHS[provider];
