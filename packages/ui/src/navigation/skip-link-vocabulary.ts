/**
 * The id every page's `<main>` carries and the skip link targets (task 203.3; UX-99). One value for both, in a
 * directive-free module so a Server Component layout and a client shell read the same spelling — a link to an id
 * nothing carries is a skip link that silently does nothing.
 */
export const MAIN_CONTENT_ID = 'main-content';
