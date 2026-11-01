/**
 * The configuration-store `kind`s `core/calculator` reads (AD-4, DR-3).
 *
 * Underscores because the seed loader turns a filename's dashes into them —
 * `config/seed/emission-factor-set.md.json` publishes under `emission_factor_set`. Getting it wrong is silent: the
 * entry is simply never found.
 */

/**
 * FR-71's emission and conversion factor sets (task 37.1). **Scope is the country**, on the legal forms' and the
 * NACE classifier's precedent (§7.2): the grid factor a location-based Scope 2 figure rests on is national, so one
 * global set would apply Moldova's grid to a site anywhere. **Effective-dated by the store's own schedule**, one window
 * per set, and `PRIMARY KEY (kind, scope, validity WITHOUT OVERLAPS)` is what makes two sets in force for one period a
 * refused write rather than a convention (§7.9, §12.3).
 */
export const EMISSION_FACTOR_SET_CONFIG_KIND = 'emission_factor_set';

/**
 * The outbox event a publication writes when the factor set in force for a window changes (task 37.3) — the job
 * `FactorSetReplacedHandler` claims on the worker, and the start of FR-166's factor half.
 */
export const FACTOR_SET_REPLACED = 'calculator.factor_set_replaced';
