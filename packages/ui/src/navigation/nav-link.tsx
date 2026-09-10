import type { ComponentType, ReactNode } from 'react';
import type { AriaCurrent } from './nav-link-vocabulary';

/**
 * The link seam shared by this package's navigation surfaces (task 106).
 *
 * **Extracted from `workspace-nav.tsx` when `WizardModuleItem` became the second consumer**, which
 * is the moment that module's own note said to widen it: *"widening it is a decision taken when a
 * consumer actually needs an anchor prop it does not cover."* The wizard rail marks position in an
 * ordered progression, so it needs `step` where the workspace tier needs `page`.
 *
 * **Why a component and not a rendered node.** A navigation component that has ARIA of its own to
 * put on the interactive element must own that element; handed a finished anchor it can only reach
 * a wrapper, and a wrapping `<span>` is `role="generic"` — a screen reader moving link-to-link
 * announces nothing from it. Task 105 records what that cost on the workspace tier. So the app
 * injects its router here and the package keeps the semantics.
 *
 * Directive-free on purpose: both consumers are read by Server Components, and although a `type`
 * is erased, `Anchor` is a runtime value and would become a client reference behind `'use client'`.
 */

/**
 * The shape of a link a navigation surface can render. Deliberately narrow rather than a
 * polymorphic `as`: these four props are all any of them sets.
 */
export type NavLinkComponent = ComponentType<{
  href: string;
  children: ReactNode;
  className?: string;
  'aria-current'?: AriaCurrent;
}>;

/**
 * The fallback when no router is injected. Correct for a server-rendered nav, and wrong only if
 * the app needed its own `Link` — in which case a missing locale prefix shows on the first click
 * rather than staying silent.
 */
export const Anchor: NavLinkComponent = ({ href, children, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);
