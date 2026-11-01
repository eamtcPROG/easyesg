'use client';

import { useEffect } from 'react';
import { focusField } from './focus-field';

/**
 * **A finding's address, landed** (task 42.3; FR-42, UC-39; `architecture.md` §12.5.6's task-42 row (g)) — when the step
 * mounts, and whenever the address's fragment changes, focus moves into the field it names.
 *
 * **The address decides, never the link that was pressed**: a finding's link from S-08 to another step is a step change
 * like any other, and this runs as the step mounts; to a field on the open step it is a fragment, which the browser
 * follows and announces as `hashchange`; a shared or reloaded address arrives the first way. So every route to a field
 * is one mechanism, and opening the address is the test of it (FR-42 AC-3).
 *
 * A Client Component for the effect, and it draws nothing.
 */
export function FieldFocus() {
  useEffect(() => {
    const land = () => {
      focusField({ document, hash: window.location.hash });
    };
    land();
    window.addEventListener('hashchange', land);
    return () => window.removeEventListener('hashchange', land);
  }, []);

  return null;
}
