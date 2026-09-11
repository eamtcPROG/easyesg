/**
 * `features/notifications`
 *
 * In-app notification centre and preferences.
 *
 * Mirrors `apps/api/src/modules/platform/notification`. S-26.
 *
 * FR-161 requires an unread count available from any screen. It polls: a push transport exists
 * nowhere in §5.4, §10.4 or the edge configuration, and introducing one is an amendment to
 * those sections rather than an implementation detail (§11.1).
 *
 * Not built. When it is, it holds the kinds its screens have — `components/ · tools/ · actions/`
 * (`one-kind-per-folder`); the scaffold folders went in task 134, and this barrel stays until then.
 */
export {};
