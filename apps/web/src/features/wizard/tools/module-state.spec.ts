import { COMPLETION_STATUS, REPORT_SCOPE, type DisclosureModuleSummary, type ModuleRollUp } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import {
  MODULE_GROUP,
  groupCount,
  moduleChecksOf,
  modulesInScope,
  moduleGroups,
  moduleStateOf,
  type ModuleChecks,
} from './module-state';

const summary = (overrides: Partial<DisclosureModuleSummary> = {}): DisclosureModuleSummary => ({
  module: 'B1',
  answered: 0,
  total: 5,
  lastAnsweredAt: null,
  applicable: true,
  omitted: false,
  applicabilityCause: null,
  ...overrides,
});

const cause = (answer: string | null): DisclosureModuleSummary['applicabilityCause'] => ({
  condition: 'numeric_at_least',
  drivers: [{ elementKey: 'NumberOfEmployees', label: null }],
  threshold: '50',
  answer,
});

/** A module as the last run left it (task 41.3). */
const checked = (module: string, status: ModuleRollUp['status'], outstanding = 0): ModuleRollUp => ({
  module,
  resolved: status === COMPLETION_STATUS.NOT_STARTED ? 0 : 3,
  reasoned: 0,
  outstanding,
  status,
  outstandingFields: [],
});
const run = (...modules: ModuleRollUp[]): ModuleChecks => ({ modules });

describe('moduleStateOf (task 42.2: the last run’s roll-up)', () => {
  // Wire values pinned on purpose: these are `WIZARD_STEP_STATE`'s members, and a renamed value must break here.
  it('reads complete, in progress and not started from the last run, as it left them', () => {
    const checks = run(
      checked('B1', COMPLETION_STATUS.COMPLETE),
      checked('B2', COMPLETION_STATUS.IN_PROGRESS, 3),
      checked('B3', COMPLETION_STATUS.NOT_STARTED, 7),
    );
    expect(moduleStateOf({ summary: summary({ module: 'B1', answered: 0 }), checks })).toBe('complete');
    expect(moduleStateOf({ summary: summary({ module: 'B2', answered: 5 }), checks })).toBe('in_progress');
    // As the run left it (182/26): answered since, still what the run found until the next run.
    expect(moduleStateOf({ summary: summary({ module: 'B3', answered: 2 }), checks })).toBe('not_started');
  });

  it('reads a module no run has checked as not started with nothing answered, and not checked yet otherwise', () => {
    expect(moduleStateOf({ summary: summary({ answered: 0 }), checks: null })).toBe('not_started');
    expect(moduleStateOf({ summary: summary({ answered: 3 }), checks: null })).toBe('unchecked');
    // A run that did not list this module says nothing about it.
    expect(moduleStateOf({ summary: summary({ module: 'B4', answered: 1 }), checks: run(checked('B1', COMPLETION_STATUS.COMPLETE)) })).toBe(
      'unchecked',
    );
  });

  it('reads a module B1 has not decided yet as waiting, and one it has ruled out as not applying', () => {
    const checks = run(checked('B1', COMPLETION_STATUS.NOT_STARTED));
    expect(moduleStateOf({ summary: summary({ applicable: false, total: 0, applicabilityCause: cause(null) }), checks })).toBe(
      'waiting',
    );
    expect(moduleStateOf({ summary: summary({ applicable: false, total: 0, applicabilityCause: cause('12') }), checks })).toBe(
      'inapplicable',
    );
  });

  it('treats a module ruled out with no single cause as not applying, never as waiting', () => {
    expect(moduleStateOf({ summary: summary({ applicable: false, total: 0, applicabilityCause: null }), checks: null })).toBe(
      'inapplicable',
    );
  });

  it('reads the reporter’s omission before applicability and before the run, so neither replaces their statement', () => {
    const checks = run(checked('B1', COMPLETION_STATUS.COMPLETE));
    expect(moduleStateOf({ summary: summary({ omitted: true, answered: 5 }), checks })).toBe('omitted');
    expect(
      moduleStateOf({ summary: summary({ omitted: true, applicable: false, applicabilityCause: cause('12') }), checks: null }),
    ).toBe('omitted');
  });
});

describe('moduleChecksOf', () => {
  it('is the roll-up’s modules, and nothing for a report never checked or a read that failed', () => {
    const modules = [checked('B1', COMPLETION_STATUS.COMPLETE)];
    // Projected to what the list reads — the outstanding fields stay S-08's.
    expect(moduleChecksOf({ rollUp: { report: { resolved: 1, reasoned: 0, outstanding: 0, status: 'complete' }, modules } })).toEqual({
      modules: [{ module: 'B1', status: 'complete', outstanding: 0 }],
    });
    expect(moduleChecksOf({ rollUp: null })).toBeNull();
    expect(moduleChecksOf(null)).toBeNull();
  });
});

describe('groupCount', () => {
  it('counts done out of what counts, discounting the omitted and the ruled-out but not the waiting (UX-21)', () => {
    const modules = [
      summary({ module: 'B1', answered: 5 }),
      summary({ module: 'B2', answered: 2 }),
      summary({ module: 'B5', applicable: false, total: 0, applicabilityCause: cause(null) }),
      summary({ module: 'B6', omitted: true }),
      summary({ module: 'B8', applicable: false, total: 0, applicabilityCause: cause('12') }),
    ];
    const checks = run(checked('B1', COMPLETION_STATUS.COMPLETE), checked('B2', COMPLETION_STATUS.IN_PROGRESS, 1));

    expect(groupCount({ modules, checks })).toEqual({
      done: 1,
      counted: 3,
      discounted: ['B6', 'B8'],
      waiting: ['B5'],
      checked: true,
    });
  });

  it('says no run has counted where none has checked the report', () => {
    expect(groupCount({ modules: [summary({ answered: 5 })], checks: null })).toMatchObject({ done: 0, checked: false });
  });

  it('is nothing done out of nothing for an empty group', () => {
    expect(groupCount({ modules: [], checks: null })).toEqual({
      done: 0,
      counted: 0,
      discounted: [],
      waiting: [],
      checked: false,
    });
  });
});

describe('moduleGroups', () => {
  it('splits the Comprehensive Module from the Basic by the standard’s own letter, keeping the order', () => {
    // The taxonomy's order, which no sort reproduces: a string sort would put B10 before B2.
    const groups = moduleGroups(
      ['B1', 'B2', 'B10', 'B11', 'C1', 'C2'].map((module) => summary({ module })),
    );

    expect(groups.map((entry) => entry.group)).toEqual([MODULE_GROUP.BASIC, MODULE_GROUP.COMPREHENSIVE]);
    expect(groups[0]?.modules.map((m) => m.module)).toEqual(['B1', 'B2', 'B10', 'B11']);
    expect(groups[1]?.modules.map((m) => m.module)).toEqual(['C1', 'C2']);
  });

  it('draws one group for a Basic-only report', () => {
    expect(moduleGroups([summary({ module: 'B1' })]).map((entry) => entry.group)).toEqual([MODULE_GROUP.BASIC]);
  });
});

describe('modulesInScope', () => {
  const served = ['B1', 'B2', 'B11', 'C1', 'C9'].map((module) => summary({ module }));

  it('asks a Basic report the Basic Module alone, in the order served', () => {
    expect(modulesInScope({ modules: served, scope: REPORT_SCOPE.BASIC }).map((m) => m.module)).toEqual([
      'B1',
      'B2',
      'B11',
    ]);
  });

  it('asks a report whose scope carries the Comprehensive Module every module', () => {
    expect(
      modulesInScope({ modules: served, scope: REPORT_SCOPE.BASIC_AND_COMPREHENSIVE }).map((m) => m.module),
    ).toEqual(['B1', 'B2', 'B11', 'C1', 'C9']);
  });
});
