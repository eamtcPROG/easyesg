import { chromium } from 'playwright';
import { CHROMIUM_BUILD } from './chromium-build.js';

/**
 * §12.5.9's control 2, run by the Dockerfile once Chromium is installed: launch the browser the image holds and refuse
 * the build when it is not the one `CHROMIUM_BUILD` names. Chromium is therefore present by construction — this is the
 * proof that it launches — and the build it answers is a fact checked at image time, never discovered at render time.
 */
const browser = await chromium.launch();
const build = browser.version();
await browser.close();
if (build !== CHROMIUM_BUILD) {
  console.error(`The image holds Chromium ${build}; the renderer is pinned to ${CHROMIUM_BUILD}.`);
  process.exit(1);
}
console.log(`Chromium ${build}, as pinned.`);
