import type { useTranslations } from 'next-intl';

/**
 * A unit code's symbol in the reader's words — out of `StepField` since task 95, when the kept-answer notice became
 * the second reader naming the same units, so the two cannot word one unit two ways.
 *
 * **The codes are EFRAG's `measurementGuidance` set across both registered versions** (task 91.4): the standard's own
 * UTR codes, used as **message keys** and never rendered — `sqkm` is an internal identifier and may not reach a reader,
 * so the symbols are catalogue content like every other string. Unexported, as `TYPED_AXIS` in
 * `section/step-fields.tsx` is: the record below is the only reader.
 *
 * **The code itself is the fallback**, and that is a decision rather than a shrug: a UTR code is a *published*
 * identifier a reader can look up — the user-facing-text rule's own exception for a reference shown on purpose — while
 * the alternative is a quantity with no unit at all, which is the thing UX-14 exists to prevent. The extractor asserts
 * this set, so a release adding an eighth fails there rather than arriving here as a bare code.
 */
const UNIT_CODE = {
  KILOGRAM: 'kg',
  TONNE: 't',
  CUBIC_METRE: 'm3',
  MEGAWATT_HOUR: 'MWh',
  TONNE_CO2_EQUIVALENT: 'tCO2e',
  HECTARE: 'ha',
  SQUARE_KILOMETRE: 'sqkm',
} as const;

type UnitTranslator = ReturnType<typeof useTranslations<'organization.wizard.field.units'>>;

/** Code to symbol, built with literal keys so a missing symbol is a compile error rather than a blank beside a number. */
export function unitWords(t: UnitTranslator): Readonly<Record<string, string>> {
  return {
    [UNIT_CODE.KILOGRAM]: t('kg'),
    [UNIT_CODE.TONNE]: t('t'),
    [UNIT_CODE.CUBIC_METRE]: t('m3'),
    [UNIT_CODE.MEGAWATT_HOUR]: t('MWh'),
    [UNIT_CODE.TONNE_CO2_EQUIVALENT]: t('tCO2e'),
    [UNIT_CODE.HECTARE]: t('ha'),
    [UNIT_CODE.SQUARE_KILOMETRE]: t('sqkm'),
  };
}
