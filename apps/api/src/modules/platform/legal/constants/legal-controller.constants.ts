/**
 * Where the controller the legal documents name lives in the configuration store (task 75; `architecture.md`
 * §12.5.6's task-75 row (7)).
 *
 * Seeded from `config/seed/legal-controller.global.json` — the loader folds the filename's dash into an underscore,
 * so the kind is spelled with one here. **One scope, `global`**: the platform has one operator, and its registered
 * name and address are one value each as registered, not one per locale.
 */
export const LEGAL_CONTROLLER_CONFIG_KIND = 'legal_controller';

export const LEGAL_CONTROLLER_CONFIG_SCOPE = 'global';
