import { useEffect } from 'react';
import type { UseFormSetFocus } from 'react-hook-form';
import type { EntityFields } from '../../tools/entity-fields';
import { landingInput } from '../../tools/field-landing';

/**
 * **A finding's way to S-13, landed** (task 210; FR-42 behaviour 6, UX-22; `architecture.md` §12.5.6's task-210 row
 * (2)) — where the address names a field the entity's record answers, focus moves into its input as the record mounts,
 * as a finding's address lands in a step's field. The form's own `setFocus` finds the input, so the landing follows the
 * field wherever the section draws it; a disabled input — an archived entity's — takes no focus, and nothing else does.
 *
 * Beside the form, its one reader; no directive, since it is only ever called from the form's client boundary.
 */
export function useFieldLanding(setFocus: UseFormSetFocus<EntityFields>): void {
  useEffect(() => {
    const input = landingInput(window.location.hash);
    if (input !== null) setFocus(input);
  }, [setFocus]);
}
