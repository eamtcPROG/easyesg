'use client';

import { GHG_SCOPE, type GhgScope } from '@easyesg/contracts';
import { useTranslations } from 'next-intl';
import { CALCULATOR_MESSAGES } from './calculator-messages';

/**
 * The words for what the factor set names by key — its sources, their units and the scopes they count toward (task
 * 39.1; OQ-43: a source ships as data, its name with the release).
 *
 * **Literal keys, as the wizard's `unitNames` and `rowNames`**, so a source this file words and the catalogue lacks
 * fails `pnpm typecheck` rather than rendering a blank. **A key it does not word falls back to a neutral name**, never
 * the key itself — a source an operator published ahead of the release that words it is still a line someone can
 * enter, and `natural_gas` on a screen is the internal identifier the root `CLAUDE.md` forbids. Read by the board's
 * parts and the add form alike, which is why it is in `shared/`.
 */
export function useCalculatorWords() {
  const t = useTranslations(CALCULATOR_MESSAGES);
  const sources: Readonly<Record<string, string>> = {
    natural_gas: t('sources.natural_gas'),
    diesel: t('sources.diesel'),
    heating_oil: t('sources.heating_oil'),
    residual_fuel_oil: t('sources.residual_fuel_oil'),
    lpg: t('sources.lpg'),
    coal: t('sources.coal'),
    wood: t('sources.wood'),
    diesel_road: t('sources.diesel_road'),
    petrol_road: t('sources.petrol_road'),
    lpg_road: t('sources.lpg_road'),
    electricity_grid: t('sources.electricity_grid'),
  };
  const units: Readonly<Record<string, string>> = {
    m3: t('units.m3'),
    l: t('units.l'),
    t: t('units.t'),
    kg: t('units.kg'),
    kWh: t('units.kWh'),
    MWh: t('units.MWh'),
    tCO2e: t('units.tCO2e'),
  };
  const scopes: Readonly<Record<GhgScope, string>> = {
    [GHG_SCOPE.SCOPE_1]: t('scopes.scope_1'),
    [GHG_SCOPE.SCOPE_2_LOCATION_BASED]: t('scopes.scope_2_location_based'),
  };
  const groups: Readonly<Record<GhgScope, string>> = {
    [GHG_SCOPE.SCOPE_1]: t('groups.scope_1'),
    [GHG_SCOPE.SCOPE_2_LOCATION_BASED]: t('groups.scope_2_location_based'),
  };
  const unknownSource = t('unknownSource');
  return {
    sourceName: (key: string): string => sources[key] ?? unknownSource,
    // A unit no catalogue words is shown as its code: a published unit symbol is a reference a reader can cite, which
    // the wizard's `unitNames` decided first (task 91.4) — and a figure with no unit at all is worse.
    unitName: (code: string): string => units[code] ?? code,
    scopeName: (scope: GhgScope): string => scopes[scope],
    groupName: (scope: GhgScope): string => groups[scope],
  };
}
