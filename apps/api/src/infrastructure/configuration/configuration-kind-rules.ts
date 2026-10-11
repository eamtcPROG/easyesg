import { EMISSION_FACTOR_SET_CONFIG_KIND, FACTOR_SET_REPLACED } from '@api/modules/core/calculator/constants/calculator.constants';
import { factorSetRefusal } from '@api/modules/core/calculator/domain/factor-set-publication';
import { PRESENTATION_PRECISION_CONFIG_KIND } from '@api/modules/platform/localization/constants/presentation-precision.constants';
import { presentationPrecisionRefusal } from '@api/modules/platform/localization/domain/presentation-precision';
import { isWordedAsFindingInEveryLocale } from '@api/app/messages/committed-catalogues';
import { VALIDATION_RULE_SET_CONFIG_KIND } from '@api/modules/core/validation/constants/validation.constants';
import { ruleSetRefusal } from '@api/modules/core/validation/domain/rule-set-publication';
import {
  VSME_DIGITAL_TEMPLATE_CONFIG_KIND,
  VSME_DIGITAL_TEMPLATE_MAP_CONFIG_KIND,
} from '@api/modules/platform/taxonomy/constants/taxonomy.constants';
import { digitalTemplateRefusal } from '@api/modules/platform/taxonomy/domain/digital-template-entry';
import { digitalTemplateMapRefusal } from '@api/modules/platform/taxonomy/domain/digital-template-map-refusal';
import { committedTemplate, efragDirectory } from '@api/modules/platform/taxonomy/services/committed-template';

/**
 * What a publication asks of a kind beyond writing it (tasks 37.3, 37.4; `architecture.md` §12.5.6's task-37.3/37.4
 * row (1), (2)).
 *
 * **Keyed by kind, and declared here rather than injected**, because the seed loader builds `ConfigurationPublisher`
 * with no container: a rule a module registered at boot would not reach the one path that publishes a factor set
 * until A-05 exists, and a seed that skipped it is how a malformed set would reach a run. The rules themselves are the
 * owning module's — this table only says which kind they bind.
 *
 * - **`refusal`** answers why a payload may not be published, or `null`. Asked before anything is written.
 * - **`replaced`** names the outbox event written, on the publication's own transaction (P-8), when the revision in
 *   force for a slot changes — a publication over an occupied window, or a revert. A publication into an empty window
 *   replaces nothing and announces nothing.
 */
export interface ConfigurationKindRule {
  readonly refusal?: (payload: unknown) => string | null;
  readonly replaced?: string;
}

const RULES: Readonly<Record<string, ConfigurationKindRule>> = {
  [EMISSION_FACTOR_SET_CONFIG_KIND]: { refusal: factorSetRefusal, replaced: FACTOR_SET_REPLACED },
  // A precision the reader would not read is refused where someone can correct it (task 39.2).
  [PRESENTATION_PRECISION_CONFIG_KIND]: { refusal: presentationPrecisionRefusal },
  // A rule set the interpreter cannot read, or whose message is not worded in its three parts in every locale, is
  // refused before it is written — the seed included, which is why the wording is the committed catalogues' rather than
  // the engine's (tasks 41.1, 42).
  [VALIDATION_RULE_SET_CONFIG_KIND]: {
    refusal: (payload) => ruleSetRefusal({ payload, wordedAsFinding: isWordedAsFindingInEveryLocale }),
  },
  // A template registration the registry would not read — a path for a file name, a digest that is not one — is
  // refused where the operator registering it can correct it, not found by the first Excel export (task 45.3).
  [VSME_DIGITAL_TEMPLATE_CONFIG_KIND]: { refusal: digitalTemplateRefusal },
  // A map that names a cell the export may not write in the binary it was read from — or names a binary the release
  // does not hold — is refused before the first Excel export meets it (task 46.1).
  [VSME_DIGITAL_TEMPLATE_MAP_CONFIG_KIND]: {
    refusal: (payload) =>
      digitalTemplateMapRefusal({ payload, binaryOf: (map) => committedTemplate({ directory: efragDirectory(), ...map }) }),
  },
};

/** The kind's rule, or none: most kinds are written as they come and announce nothing. */
export const ruleFor = (kind: string): ConfigurationKindRule => RULES[kind] ?? {};

/**
 * The event `replaced` names: which slot moved, and the revision leaving it for the one entering. Validated by the
 * handler that reads it, as every job payload is.
 */
export interface SlotReplaced {
  readonly scope: string;
  readonly leavingRevision: number;
  readonly enteringRevision: number;
}
