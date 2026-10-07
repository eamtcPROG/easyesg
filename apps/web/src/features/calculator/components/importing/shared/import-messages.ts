import { CALCULATOR_MESSAGES } from '../../shared/calculator-messages';

/**
 * The import panel's namespace, declared once (task 204.2): its section, the file arm, the mapping arm's parts and the
 * notice after an import all read it. This folder admits what more than one of `importing/`' folders reads.
 */
export const IMPORT_MESSAGES = `${CALCULATOR_MESSAGES}.import` as const;
