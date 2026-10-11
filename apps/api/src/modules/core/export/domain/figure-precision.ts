import type { DisclosureField } from '@api/modules/core/disclosure/models/wizard-step.model';

/**
 * How many digits a figure the files print is shown to (`architecture.md` §12.5.6's task-182 row (3); task-46 row (10)):
 * the `presentation_precision` artefact, by unit and — for a figure the platform computes with no unit — by element.
 */
export interface FigurePrecision {
  /** By unit code — `tCO2e`, `MWh`. */
  readonly units: Readonly<Record<string, number>>;
  /** By element, for a figure computed with no unit; a percentage's places count decimals of the percent. */
  readonly elements: Readonly<Record<string, number>>;
}

type Presented = Pick<DisclosureField, 'elementKey' | 'unitCode' | 'unitCodes'>;

/**
 * The unit a figure is presented in: the one it is stored with, or, where none is stored, its element's one admitted
 * unit — **a calculated or derived figure is stored with no unit** (B3's scopes and total are tonnes CO2e because the
 * standard admits nothing else), and a file that read only the stored column printed it as a bare number with every
 * digit. An element admitting several units, or none, names none.
 */
export function presentedUnit(field: Presented): string | null {
  if (field.unitCode !== null) return field.unitCode;
  return field.unitCodes.length === 1 ? field.unitCodes[0] : null;
}

/**
 * The places a figure is shown to — its presented unit's, else its element's, else none, which keeps every digit and
 * so is never wrong, only long (the artefact fails open the same way).
 */
export function presentedPlaces(input: { readonly field: Presented; readonly precision: FigurePrecision }): number | null {
  const { field, precision } = input;
  const unit = presentedUnit(field);
  if (unit !== null && precision.units[unit] !== undefined) return precision.units[unit];
  return precision.elements[field.elementKey] ?? null;
}
