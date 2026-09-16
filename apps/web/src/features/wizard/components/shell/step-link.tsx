'use client';

import type { NavLinkComponent } from '@easyesg/ui';
import type { ComponentProps, MouseEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { isPlainClick } from '../../tools/plain-click';
import { useWhenSessionHeld } from '../providers/use-when-session-held';

/**
 * The module rail's link (task 92) — `@/i18n/navigation`'s `Link`, which the rail injected into
 * `WizardModuleItem` before, now holding a plain click while the session tier is asked whether the session
 * is still held (`use-when-session-held.ts`).
 *
 * **Injected as a component, as before**, so `WizardModuleItem` keeps owning the anchor and the
 * `aria-current="step"` on it (task 106). It is a Client Component handed to a server-rendered rail by
 * reference, which crosses nothing: the rail renders it, and its children are the item's label and count.
 *
 * A modified click is left to the browser (`plain-click.ts`), and so is prefetching — the probe delays only
 * the moment of navigating, not the route's readiness.
 */
export function StepLink({ href, children, className, 'aria-current': ariaCurrent }: ComponentProps<NavLinkComponent>) {
  const router = useRouter();
  const whenSessionHeld = useWhenSessionHeld();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    whenSessionHeld(() => router.push(href));
  };

  return (
    <Link href={href} className={className} aria-current={ariaCurrent} onClick={onClick}>
      {children}
    </Link>
  );
}
