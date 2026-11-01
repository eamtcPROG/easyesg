/**
 * S-28's namespaces, declared once (task 134's parent-close review; widened by task 169).
 *
 * **In `components/shared/` on one test: more than one sibling reads each.** The record's own keys — the shared
 * current-password label, *Cancel*, the refusal copy — are read by `section/`, `shared/` and every row; each row's
 * namespace is read by the two or three files its folder splits into.
 */
export const CREDENTIALS_MESSAGES = 'identity.credentials';
export const PASSWORD_MESSAGES = 'identity.credentials.password';
export const FACTOR_MESSAGES = 'identity.credentials.factor';
export const PROVIDERS_MESSAGES = 'identity.credentials.providers';
export const LAST_WAY_IN_MESSAGES = 'identity.credentials.lastWayIn';
export const ARRIVAL_MESSAGES = 'identity.credentials.arrival.recovered';
