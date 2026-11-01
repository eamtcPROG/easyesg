import { expect, type Locator } from '@playwright/test';

/**
 * Waits until React has taken over an element the server rendered (task 179.1).
 *
 * **Why a journey needs it.** A wizard step's controls exist as markup before hydration, and a `fill` that lands first
 * changes the DOM with no React handler to hear it: a combobox then holds the typed text with its list shut — found
 * under the full suite's load, where the step's hydration ran behind four journeys' fills (the trace showed the input
 * holding *Amoniac*, `aria-expanded="false"`). A reader typing that early loses the keystrokes the same way; a
 * journey about the list, not about the first second, waits.
 *
 * **What it reads.** React attaches its props to a DOM node under a `__reactProps$…` key when it hydrates the node —
 * the one fact that distinguishes *rendered* from *handled*. The credential forms need no such probe, since their
 * submit is disabled until hydration (task 153) and a journey waits on that.
 */
export async function untilHydrated(element: Locator): Promise<void> {
  await expect
    .poll(() => element.evaluate((node) => Object.keys(node).some((key) => key.startsWith('__reactProps$'))), {
      timeout: 15_000,
    })
    .toBe(true);
}
