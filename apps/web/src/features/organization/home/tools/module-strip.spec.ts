import { COMPLETION_STATUS, REPORT_SCOPE, type DisclosureModuleSummary, type ModuleRollUp } from '@easyesg/contracts';
import { WIZARD_STEP_STATE } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import type { ModuleChecks } from '@/features/wizard/tools/module-state';
import { hasAnswers, legendStates, moduleStrip } from './module-strip';

/**
 * The resume card's strip (task 255). What each module's state *is* belongs to `moduleStateOf` and its own spec; what
 * is asserted here is what the home adds — the report's scope, where work stopped, and which states the legend
 * explains.
 */

const summary = (overrides: Partial<DisclosureModuleSummary> = {}): DisclosureModuleSummary => ({
  module: 'B1',
  answered: 0,
  comprehensiveAnswered: 0,
  total: 5,
  lastAnsweredAt: null,
  applicable: true,
  omitted: false,
  applicabilityCause: null,
  ...overrides,
});

const checked = (module: string, status: ModuleRollUp['status'], outstanding = 0): ModuleRollUp => ({
  module,
  resolved: status === COMPLETION_STATUS.NOT_STARTED ? 0 : 3,
  reasoned: 0,
  outstanding,
  status,
  outstandingFields: [],
});

const MODULES = [
  summary({ module: 'B1', answered: 5, lastAnsweredAt: 1_000 }),
  summary({ module: 'B2', answered: 2, lastAnsweredAt: 3_000 }),
  summary({ module: 'B3' }),
  summary({ module: 'C1' }),
];

const CHECKS: ModuleChecks = { modules: [checked('B1', COMPLETION_STATUS.COMPLETE)] };

describe('the strip', () => {
  it('holds the modules a Basic report asks, in the standard’s order, each in its wizard state', () => {
    const strip = moduleStrip({ modules: MODULES, checks: CHECKS, scope: REPORT_SCOPE.BASIC, current: 'B2' });

    expect(strip.map((entry) => entry.module)).toEqual(['B1', 'B2', 'B3']);
    // Wire values pinned on purpose — `WIZARD_STEP_STATE`'s members, which S-07's list draws from the same rule.
    expect(strip.map((entry) => entry.state)).toEqual(['complete', 'unchecked', 'not_started']);
  });

  it('holds the Comprehensive modules too where the report asks them', () => {
    const strip = moduleStrip({
      modules: MODULES,
      checks: CHECKS,
      scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE,
      current: undefined,
    });

    expect(strip.map((entry) => entry.module)).toEqual(['B1', 'B2', 'B3', 'C1']);
  });

  it('rings exactly the module where work stopped', () => {
    const strip = moduleStrip({ modules: MODULES, checks: CHECKS, scope: REPORT_SCOPE.BASIC, current: 'B2' });

    expect(strip.filter((entry) => entry.current).map((entry) => entry.module)).toEqual(['B2']);
  });
});

describe('the legend', () => {
  it('explains only the states the strip shows, settled work first', () => {
    const strip = moduleStrip({ modules: MODULES, checks: CHECKS, scope: REPORT_SCOPE.BASIC, current: 'B2' });

    expect(legendStates(strip)).toEqual([
      WIZARD_STEP_STATE.COMPLETE,
      WIZARD_STEP_STATE.UNCHECKED,
      WIZARD_STEP_STATE.NOT_STARTED,
    ]);
  });

  it('is one entry for a report nobody has touched', () => {
    const strip = moduleStrip({
      modules: [summary({ module: 'B1' }), summary({ module: 'B2' })],
      checks: null,
      scope: REPORT_SCOPE.BASIC,
      current: 'B1',
    });

    expect(legendStates(strip)).toEqual([WIZARD_STEP_STATE.NOT_STARTED]);
  });
});

describe('whether anything is answered', () => {
  it('tells *you stopped in* from *it starts with*', () => {
    expect(hasAnswers(MODULES)).toBe(true);
    expect(hasAnswers([summary({ module: 'B1' })])).toBe(false);
  });
});
