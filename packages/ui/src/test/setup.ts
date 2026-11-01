/**
 * Vitest setup — the same two registrations as `apps/{web,admin}/src/test/setup.ts`, needed here
 * the moment this package grew its first spec (the `@easyesg/ui/forms` layer) and for the same
 * reason: `globals: false` withholds the global `afterEach` that Testing Library's automatic
 * cleanup relies on, and without it every `render` accumulates into one document and turns into
 * "found multiple elements" failures.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
