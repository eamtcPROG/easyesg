/**
 * The units S-09's computed figures are in (task 39.2; §12.5.6's task-39 row (6)) — the taxonomy's own UTR codes, which
 * are also the keys `presentation_precision` gives places by and the catalogue names them by. **Energy in MWh and
 * emissions in tCO₂e**, as the factor set publishes and B3 reports, never rescaled for display.
 */
export const FIGURE_UNIT = {
  ENERGY: 'MWh',
  TONNES: 'tCO2e',
} as const;

export type FigureUnit = (typeof FIGURE_UNIT)[keyof typeof FIGURE_UNIT];
