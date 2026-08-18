import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/**
 * Locale-aware navigation. **These are the only navigation APIs this app may use.**
 *
 * `next/link` and `next/navigation` are banned by an ESLint rule (`no-restricted-imports`)
 * because the failure is silent: a raw `<Link href="/reports">` renders a working-looking
 * anchor that drops the locale prefix, and the user lands on a redirect that resets their
 * language. Nothing throws, nothing logs, and it survives review.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
