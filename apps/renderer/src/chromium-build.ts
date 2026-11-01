/**
 * The Chromium build the renderer is pinned to (architecture.md §12.5.9, control 2). It is not chosen here — Playwright's
 * pin decides it (OQ-27): 1.62.1 ships 151.0.7922.34. `assert-chromium.ts` refuses to finish the image when the
 * browser it installed answers another build, so a moved Playwright pin cannot change the renderer unnoticed. Moving
 * this line is the deliberate act control 3 asks for, and it re-runs the document corpus through veraPDF.
 */
export const CHROMIUM_BUILD = '151.0.7922.34';
