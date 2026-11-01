'use client';

import type { CalcFigures } from '@easyesg/contracts';
import { createContext, use, useMemo, type ReactNode } from 'react';

/**
 * What a step's computed figures are shown with (task 39.3; §12.5.6's task-39 row (7)): the places
 * `presentation_precision` gives each unit, which B3's calculated scopes round to, and on B3 the figures the calculator
 * wrote, so an overridden scope shows the computed figure it superseded beside the substitute (UX-43), and the report the
 * figure actions act on. **A field's own figure rounds to the places its field carries since task 211** — chosen on the
 * api by the rule the PDF chooses by (§12.5.6's task-211 row (1)) — and needs nothing here.
 *
 * **A context rather than three props threaded through `StepFields` and each `StepField`**: the section reads them once
 * and the few fields that need them — B3's two scopes — reach for them where they render.
 */
export interface StepFigures {
  readonly reportId: string;
  readonly precision: Readonly<Record<string, number>>;
  /** The latest run's figures, on the step whose fields a run writes; `null` elsewhere, or where the read failed. */
  readonly calculator: CalcFigures | null;
}

const StepFiguresContext = createContext<StepFigures | null>(null);

export function StepFiguresProvider({
  reportId,
  precision,
  calculator,
  children,
}: StepFigures & { readonly children: ReactNode }) {
  const value = useMemo(() => ({ reportId, precision, calculator }), [reportId, precision, calculator]);
  return <StepFiguresContext.Provider value={value}>{children}</StepFiguresContext.Provider>;
}

/**
 * The step's figures — or, outside a step, **no places and no calculator**: a field drawn on its own (a component spec,
 * a read under support access) shows a computed figure with every digit, the same fail-open answer
 * `PresentationPrecision` gives when its artefact cannot be read, rather than refusing to draw the field.
 */
export function useStepFigures(): StepFigures {
  return use(StepFiguresContext) ?? NO_STEP_FIGURES;
}

const NO_STEP_FIGURES: StepFigures = { reportId: '', precision: {}, calculator: null };
