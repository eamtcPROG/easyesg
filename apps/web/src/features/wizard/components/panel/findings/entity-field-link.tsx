import type { MouseEvent, ReactNode } from 'react';
import { Link } from '@/i18n/navigation';
import { isPlainClick } from '../../../tools/plain-click';
import { useLeaveGuard } from '../../shared/use-leave-guard';

/**
 * **A finding's way to a field the entity's record answers** (task 210; FR-42 behaviour 6; `architecture.md` §12.5.6's
 * task-210 row (2)) — the entity's IDNO, which no step holds: S-13's record at the field, where focus lands as the
 * record opens. **It leaves the wizard as the exit does** (UX-37): with answers not yet sent, the reader is asked first,
 * by the dialogue the hook draws beside the link.
 *
 * A component of its own because the guard is a hook, which `FindingLink` may not call for one arm of three. No
 * directive: drawn inside the panel's section, a client boundary already.
 */
export function EntityFieldLink({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  const { leave, guard } = useLeaveGuard();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    leave(href);
  };

  return (
    <>
      <Link href={href} className={className} onClick={onClick}>
        {children}
      </Link>
      {guard}
    </>
  );
}
