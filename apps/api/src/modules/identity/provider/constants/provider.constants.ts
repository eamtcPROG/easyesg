/**
 * The configuration store `kind` under which each social provider's behaviour lives, one entry
 * per provider with the provider as its `scope` (FR-82, §12.5.6's task-24 configuration row).
 * Seeded from `config/seed/identity-provider.<provider>.json` — the seed loader turns filename
 * dashes into underscores, so the kind is spelled with one here. Edited by A-18 in task 67.
 */
export const IDENTITY_PROVIDER_CONFIG_KIND = 'identity_provider';
