/**
 * Vitest setup — `apps/web/src/test/setup.ts`'s two registrations, needed here the moment the
 * console grew its first component spec (task 23) and for the same reason: `globals: false`
 * withholds the global `afterEach` Testing Library's automatic cleanup relies on, and without
 * it every `render` accumulates into one document and "found multiple elements" failures.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
