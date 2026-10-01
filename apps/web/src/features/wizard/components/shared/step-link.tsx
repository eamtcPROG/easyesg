'use client';

import type { NavLinkComponent } from '@easyesg/ui';
import type { ComponentProps, MouseEvent } from 'react';
import { Link, useRouter } from '@/i18n/navigation';
import { isPlainClick } from '../../tools/plain-click';
import { useWhenSessionHeld } from '../providers/use-when-session-held';

/**
 * A step change's link (task 92) — `@/i18n/navigation`'s `Link`, holding a plain click while the session tier is asked
 * whether the session is still held (`use-when-session-held.ts`).
 *
 * **In `shared/` because two siblings read it** (task 179.3's convention review): `rail/` injects it into
 * `WizardModuleItem` and the strip below `wide`, and `foot/` draws *Back* and *Next* with it as a button's slotted
 * child — so a step change by either is one act, asked about once. Admission here is that test, *read by more than one
 * of `components/`' regions*, and nothing else.
 *
 * **Injected as a component in the rail**, so `WizardModuleItem` keeps owning the anchor and the `aria-current="step"`
 * on it (task 106), and since task 179.1 the step's state as its `aria-description` — both passed on here, since an
 * attribute this link drops is one the rail's promise silently loses. **`className` is passed on too**, which is what
 * the foot's `Button asChild` styles it through. It is a Client Component handed to a server-rendered parent by
 * reference, which crosses nothing: the parent renders it, and its children are text.
 *
 * A modified click is left to the browser (`plain-click.ts`), and so is prefetching — the probe delays only
 * the moment of navigating, not the route's readiness.
 */
export function StepLink({
  href,
  children,
  className,
  'aria-current': ariaCurrent,
  'aria-description': ariaDescription,
}: ComponentProps<NavLinkComponent>) {
  const router = useRouter();
  const whenSessionHeld = useWhenSessionHeld();

  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return;
    event.preventDefault();
    whenSessionHeld(() => router.push(href));
  };

  return (
    <Link href={href} className={className} aria-current={ariaCurrent} aria-description={ariaDescription} onClick={onClick}>
      {children}
    </Link>
  );
}
