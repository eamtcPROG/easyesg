import { ACCESS_MESSAGES } from '../../shared/access-messages';

/**
 * The reminder panel's namespace (task 50.3), declared once for the files under `remind/` that read it.
 *
 * **Narrowed, where S-16's own namespace is not**: `access-messages.ts` declines a namespace per region because its
 * subtrees cross regions, and `remind` does not — only `remind/` reads `organization.access.remind`, and it reads
 * nothing else of S-16's but the `identity` and `forms` words every form borrows.
 *
 * **In `remind/shared/` on one test: is it read by more than one sibling?** The section, the form and the states.
 */
export const REMIND_MESSAGES = `${ACCESS_MESSAGES}.remind` as const;
