'use client';

import { ARIA_CURRENT } from '@easyesg/ui';
import type { ReactNode } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { ROUTES } from '@/lib/routes';

/**
 * The bands' *Help centre*, marked as the page the reader is on while they are in the help centre (task 227; artboards
 * 01 … 04 draw it so in both bands) — `aria-current` on the anchor, which each band styles in its own stylesheet.
 * **A Client Component for `usePathname` alone**, `AccountRail`'s reason; the bands that draw it stay Server
 * Components. **In `shared/`**: the global tier and the public band both draw it.
 */
export function HelpCentreLink({ className, children }: { readonly className: string; readonly children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === ROUTES.HELP_CENTRE || pathname.startsWith(`${ROUTES.HELP_CENTRE}/`);

  return (
    <Link className={className} href={ROUTES.HELP_CENTRE} aria-current={current ? ARIA_CURRENT.PAGE : undefined}>
      {children}
    </Link>
  );
}
