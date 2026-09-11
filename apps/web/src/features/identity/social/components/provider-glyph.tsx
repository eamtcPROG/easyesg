import type { ReactNode } from 'react';
import type { SocialProvider } from '@easyesg/contracts';
import { GoogleGlyph } from './google-glyph';
import { MicrosoftGlyph } from './microsoft-glyph';

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
