/**
 * Where the display precision lives in the configuration store (task 39.2; §12.5.6's task-39 row (5)) — seeded from
 * `config/seed/presentation-precision.global.json`, the loader turning the filename's dash into an underscore. **One
 * scope, `global`**: a figure reads the same to every organization, which is what makes it the same figure.
 */
export const PRESENTATION_PRECISION_CONFIG_KIND = 'presentation_precision';

export const PRESENTATION_PRECISION_CONFIG_SCOPE = 'global';
