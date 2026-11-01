/**
 * Vitest setup. Two things every jsdom suite here needs, neither of which happens on its own
 * because this config keeps `globals: false` (explicit imports, like the rest of the repo):
 *
 * - jest-dom's matchers (`toBeInTheDocument`, `toHaveTextContent`, …) registered against
 *   Vitest's `expect`;
 * - Testing Library's DOM cleanup between tests — its automatic registration relies on a
 *   global `afterEach`, which `globals: false` withholds, and without it every `render`
 *   accumulates into one document and "found multiple elements" failures.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
