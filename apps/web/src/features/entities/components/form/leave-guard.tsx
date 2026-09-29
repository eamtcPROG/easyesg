'use client';

import type { NavLinkComponent } from '@easyesg/ui';
import { createContext, use, type MouseEvent } from 'react';
import { Link } from '@/i18n/navigation';

/**
 * The record's ways back, asking first while changes are unsaved (project owner, 28 Sep 2026). The arrow before the
 * title and the breadcrumb's step both lead to the index, and both are built by `packages/ui` with an injected link —
 * so this is that link, and the question is asked in one place for both.
 *
 * **`holds` answers whether it kept the reader here**: the form knows what is unsaved and opens its question, and the
 * link cancels its own navigation. Leaving is then the form's `router.push` to the same address.
 *
 * **A press that opens elsewhere is never held** — a modifier key or a middle button opens the index in another tab
 * and loses nothing here. Nor is anything outside the record: the workspace tier and the browser's own Back go
 * without asking, which is the scope the owner chose.
 */
export interface LeaveGuard {
  readonly holds: (href: string) => boolean;
}

export const LeaveGuardContext = createContext<LeaveGuard | null>(null);

const opensElsewhere = (event: MouseEvent<HTMLAnchorElement>): boolean =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

export const GuardedLink: NavLinkComponent = ({ href, children, ...rest }) => {
  const guard = use(LeaveGuardContext);

  return (
    <Link
      href={href}
      {...rest}
      onClick={(event) => {
        if (event.defaultPrevented || opensElsewhere(event)) return;
        if (guard?.holds(href)) event.preventDefault();
      }}
    >
      {children}
    </Link>
  );
};
