import type { DomainError } from '@api/app/filters/domain.error';
import type { RefusalWords } from '@api/app/filters/refusal-words';
import type { DisclosureValue, DisclosureValueKey } from './disclosure-value.model';

/**
 * A value a write refused for its own sake (task 218; §12.5.6's task-218 row (a)) — its key, the modules presenting
 * its element, so a client can lead the reporter to it, and the refusal itself, worded at the edge in the reader's
 * language.
 */
export interface RefusedValue {
  readonly key: Omit<DisclosureValueKey, 'reportId'>;
  readonly modules: readonly string[];
  readonly refusal: DomainError;
}

/** What a write did: the values it stored, and each it refused, against the version the report pins. */
export interface WriteDisclosureValuesOutcome {
  readonly stored: DisclosureValue[];
  readonly refused: RefusedValue[];
  /** The version whose labels name a refused field. */
  readonly taxonomyVersion: string;
}

/**
 * A refused value as a reader meets it (task 218): its key and modules, its field's name and member's name in their
 * language — `null` where the pinned version names it nothing — and the refusal worded.
 */
export interface WordedRefusedValue extends RefusalWords {
  readonly elementKey: string;
  readonly dimensionKey: string;
  readonly ordinal: number;
  readonly modules: readonly string[];
  readonly label: string | null;
  readonly memberLabel: string | null;
}

/** A refused derivation input as a reader meets it: its key, and the refusal worded. */
export interface WordedRefusedInput extends RefusalWords {
  readonly inputKey: string;
}

/** A derivation input a write refused, by its key (task 218). */
export interface RefusedInput {
  readonly inputKey: string;
  readonly refusal: DomainError;
}
