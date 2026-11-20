import { useTranslations } from 'next-intl';
import { INPUT_MESSAGES } from './step-messages';

/** One derivation input's words: its name — the PDF's too — and its help, S-07's alone. */
export interface InputWords {
  readonly label: string;
  readonly help: string;
}

/**
 * The derivation inputs' wording, by **literal** key so the catalogue lookup is type-checked.
 *
 * **This was `tInput(`names.${input.key}` as never)` until 9 Sep 2026** (convention review at task
 * 36's parent close), which is the shape the step forbids twice — for `rowNames` in `section/step-fields.tsx`
 * and for `unitNames` in `field/step-field.tsx` — and had then declined for the case where it matters most.
 * `config/seed/disclosure-derivation.vsme.json` is publishable data under DR-3, so a fifth
 * derivation published with a new input key rendered a field with a **blank label and blank help**
 * and every gate green; the `as never` is precisely what turned the compile error into that blank.
 *
 * A key with no wording now falls back to the neutral word, as `rowNames` does — visible, rather
 * than an unlabelled box.
 *
 * **A hook of its own since task 254**, in `shared/` on its admission test: the step's list labels each input's box with
 * it, and a computed figure's note names the inputs it waits on (`DerivedFromNote`).
 */
export function useInputWords(): Readonly<Record<string, InputWords>> {
  const tInput = useTranslations(INPUT_MESSAGES);
  // An input's name is the PDF's too, so it is the shared catalogue's (task 80.3); its help is S-07's alone.
  const tInputName = useTranslations('derivationInputNames');
  return {
    AverageGrossHourlyPayLevelOfFemaleEmployees: { label: tInputName('AverageGrossHourlyPayLevelOfFemaleEmployees'), help: tInput('help.AverageGrossHourlyPayLevelOfFemaleEmployees') },
    AverageGrossHourlyPayLevelOfMaleEmployees: { label: tInputName('AverageGrossHourlyPayLevelOfMaleEmployees'), help: tInput('help.AverageGrossHourlyPayLevelOfMaleEmployees') },
    HoursWorkedByOneFullTimeEmployee: { label: tInputName('HoursWorkedByOneFullTimeEmployee'), help: tInput('help.HoursWorkedByOneFullTimeEmployee') },
    NumberOfEmployeesAtTheBeginningOfTheReportingPeriod: { label: tInputName('NumberOfEmployeesAtTheBeginningOfTheReportingPeriod'), help: tInput('help.NumberOfEmployeesAtTheBeginningOfTheReportingPeriod') },
    NumberOfEmployeesAtTheEndOfTheReportingPeriod: { label: tInputName('NumberOfEmployeesAtTheEndOfTheReportingPeriod'), help: tInput('help.NumberOfEmployeesAtTheEndOfTheReportingPeriod') },
    NumberOfEmployeesCoveredByCollectiveBargainingAgreements: { label: tInputName('NumberOfEmployeesCoveredByCollectiveBargainingAgreements'), help: tInput('help.NumberOfEmployeesCoveredByCollectiveBargainingAgreements') },
    NumberOfEmployeesWhoLeftDuringTheReportingPeriod: { label: tInputName('NumberOfEmployeesWhoLeftDuringTheReportingPeriod'), help: tInput('help.NumberOfEmployeesWhoLeftDuringTheReportingPeriod') },
    NumberOfFemaleEmployeesAtManagementLevel: { label: tInputName('NumberOfFemaleEmployeesAtManagementLevel'), help: tInput('help.NumberOfFemaleEmployeesAtManagementLevel') },
    NumberOfMaleEmployeesAtManagementLevel: { label: tInputName('NumberOfMaleEmployeesAtManagementLevel'), help: tInput('help.NumberOfMaleEmployeesAtManagementLevel') },
    OnePercentOrMoreOfRevenuesFromHardCoalAndLignite: { label: tInputName('OnePercentOrMoreOfRevenuesFromHardCoalAndLignite'), help: tInput('help.OnePercentOrMoreOfRevenuesFromHardCoalAndLignite') },
    TenPercentOrMoreOfRevenuesFromOilFuels: { label: tInputName('TenPercentOrMoreOfRevenuesFromOilFuels'), help: tInput('help.TenPercentOrMoreOfRevenuesFromOilFuels') },
    FiftyPercentOrMoreOfRevenuesFromGaseousFuels: { label: tInputName('FiftyPercentOrMoreOfRevenuesFromGaseousFuels'), help: tInput('help.FiftyPercentOrMoreOfRevenuesFromGaseousFuels') },
    FiftyPercentOrMoreOfRevenuesFromHighIntensityElectricityGeneration: { label: tInputName('FiftyPercentOrMoreOfRevenuesFromHighIntensityElectricityGeneration'), help: tInput('help.FiftyPercentOrMoreOfRevenuesFromHighIntensityElectricityGeneration') },
    NumberOfFemaleBoardMembersAtTheEndOfTheReportingPeriod: { label: tInputName('NumberOfFemaleBoardMembersAtTheEndOfTheReportingPeriod'), help: tInput('help.NumberOfFemaleBoardMembersAtTheEndOfTheReportingPeriod') },
    NumberOfMaleBoardMembersAtTheEndOfTheReportingPeriod: { label: tInputName('NumberOfMaleBoardMembersAtTheEndOfTheReportingPeriod'), help: tInput('help.NumberOfMaleBoardMembersAtTheEndOfTheReportingPeriod') },
  };
}
