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
 * Not built. Folders are `components/ hooks/ schema/ queries/ types/`, tests colocated as
 * `*.spec.tsx`.
 */
export {};
