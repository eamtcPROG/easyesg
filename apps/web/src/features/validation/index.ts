/**
 * `features/validation`
 *
 * Findings, roll-up and finding-to-field navigation.
 *
 * Mirrors `apps/api/src/modules/core/validation`. S-08.
 *
 * The rules themselves live in `@easyesg/validation` and run in both tiers - one interpreter,
 * two execution sites, no drift (§9.8). What lives here is presentation and navigation.
 *
 * UX-22: every finding is a link that moves FOCUS to the originating field and scrolls it into
 * view. A silent scroll without focus movement is an accessibility failure, not a near miss.
 *
 * Not built. When it is, it holds the kinds its screens have — `components/ · tools/ · actions/`
 * (`one-kind-per-folder`); the scaffold folders went in task 134, and this barrel stays until then.
 */
export {};
