import type { FieldAddress } from '@easyesg/validation';
import type { MouseEvent, ReactNode } from 'react';
import { writeKey } from '../../../tools/autosave-state';
import { fieldAnchor, fieldHref } from '../../../tools/field-anchor';
import { isPlainClick } from '../../../tools/plain-click';
import { StepLink } from '../../shared/step-link';
import { useFindingFollow } from '../shared/finding-follow';

/**
 * **A finding's way to its field: the field's address** (task 42.3; FR-42 items 1 … 5, UX-4; `architecture.md`
 * §12.5.6's task-42 row (g)). The step lands focus in the field the address names (`FieldFocus`), so the link only has
 * to be the address.
 *
 * **On the open step it is the fragment alone**, a plain anchor the browser follows in place — no step change, a
 * history entry, and `hashchange` for the step to land on. Before it does, the panel is told (`onFollow`), so the sheet
 * below `wide` closes rather than holding focus inside it. **On another step it is that step's address**, through
 * `StepLink` like any step change, so the session is asked about first; the step lands focus as it mounts.
 *
 * `className` is passed on because `TextLink asChild` styles the anchor through it. No directive: drawn inside the
 * panel's section, a client boundary already.
 */
export function FindingLink({
  reportId,
  module,
  field,
  className,
  children,
}: {
  readonly reportId: string;
  /** The step that presents the field. */
  readonly module: string;
  readonly field: FieldAddress;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { current, onFollow } = useFindingFollow();

  if (module !== current) {
    return (
      <StepLink href={fieldHref({ reportId, module, field })} className={className}>
        {children}
      </StepLink>
    );
  }

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (isPlainClick(event)) onFollow();
  };
  return (
    <a href={`#${fieldAnchor(writeKey(field))}`} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
