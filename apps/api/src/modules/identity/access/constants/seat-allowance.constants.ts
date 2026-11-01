/**
 * Where the interim seat ceiling lives in the configuration store (task 142).
 *
 * Seeded from `config/seed/seat-allowance.global.json` — the loader turns the filename's dash into an
 * underscore, so the kind is spelled with one here, as `IDENTITY_PROVIDER_CONFIG_KIND` is.
 *
 * **One scope, `global`, and no per-organization override** (§12.5.6, 13 Sep 2026): a second lookup
 * path would be a second thing task 54.2 has to delete, and tenant identifiers would enter the store
 * for the first time. Both constants go with the artefact when 54.2 swaps the source.
 */
export const SEAT_ALLOWANCE_CONFIG_KIND = 'seat_allowance';

export const SEAT_ALLOWANCE_CONFIG_SCOPE = 'global';
