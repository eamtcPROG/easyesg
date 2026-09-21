/**
 * The configuration store's artefact kind for a notification category's behaviour (task 49.1, FR-173;
 * `architecture.md` §12.5.6's task-49.1 row).
 *
 * **One artefact per category, scoped by its key** — `NOTIFICATION_CATEGORY`'s member — so A-17 publishes
 * and reverts one category in one action (NFR-85) and each category's history reads on its own. The seed
 * files are `notification-category.<key>.json`.
 */
export const NOTIFICATION_CATEGORY_CONFIG_KIND = 'notification_category';
