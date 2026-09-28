import type { Page } from '@playwright/test';

/**
 * **Every finite animation on the page settles before a check that measures what is painted** — an axe scan above
 * all (28 Sep 2026). Axe reads colour as painted, so a surface still animating in is judged through its own
 * transparency: S-16's invitation dialogue, scanned 50 ms into its fade at opacity 0.35, read its placeholder at
 * 3.94:1 against the 5.1:1 it rests at, and passed or failed with how long the scan took to reach it. `Dialog` fades
 * in both applications, so both suites read this.
 *
 * An infinite animation, a skeleton's shimmer, would never settle and is left running; one cancelled meanwhile
 * resolves rather than failing the check.
 */
export const settleAnimations = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  );
