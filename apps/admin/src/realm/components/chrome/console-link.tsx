import type { NavLinkComponent } from '@easyesg/ui';
import { Link } from '@tanstack/react-router';

/**
 * The console's router, in the shape `packages/ui`'s navigation takes (task 67.1).
 *
 * `ConsoleNav` builds its own anchors so it can put `aria-current` on them, and takes the app's link
 * with an `href` because the package holds no router; TanStack's `Link` takes `to`. This is the one
 * place the two names meet, so a click in the navigation stays a client-side transition — preloaded on
 * intent, per the router's `defaultPreload` — rather than a document load that re-proves the session.
 */
export const ConsoleLink: NavLinkComponent = ({ href, children, ...rest }) => (
  <Link to={href} {...rest}>
    {children}
  </Link>
);
