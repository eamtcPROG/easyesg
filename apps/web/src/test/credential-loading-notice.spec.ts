import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * A credential route's loading state carries the scripting notice (task 137; §12.5.6's task-153 row as amended). With
 * scripting off, a route behind `loading.tsx` may be sent as its fallback, with the form streamed into hidden markup
 * only a script swaps in — so the fallback is where such a reader is, and task 153's explicit failure has to be there
 * too. **A static check on purpose**: which of the two a browser gets depends on how fast the section's reads answer,
 * so no browser run can hold this; `form-method.spec.ts` holds the rest. **The list is every credential form's route
 * that has a `loading.tsx`** — a new one belongs here the day it gains a boundary.
 */
const APP = join(import.meta.dirname, '../app/[locale]');
const CREDENTIAL_ROUTE_LOADING = [
  '(app)/(workspace)/account/credentials/loading.tsx',
  '(identity)/complete-account/loading.tsx',
];

describe('a credential route’s loading state says it needs JavaScript', () => {
  it.each(CREDENTIAL_ROUTE_LOADING)('%s renders the notice', (route) => {
    const source = readFileSync(join(APP, route), 'utf8');
    expect(source).toMatch(/import \{ ScriptingRequired \} from '@\/shared\/scripting-required';/u);
    expect(source).toContain('<ScriptingRequired />');
  });
});
