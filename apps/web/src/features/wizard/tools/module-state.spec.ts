import { REPORT_SCOPE, type DisclosureModuleSummary } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { MODULE_GROUP, modulesInScope, moduleGroups, moduleStateOf, rollUp } from './module-state';

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

describe('moduleStateOf', () => {
  // Wire values pinned on purpose: these are `WIZARD_STEP_STATE`'s members, and a renamed value must break here.
  it('reads the counts for a module that applies', () => {
    expect(moduleStateOf(summary({ answered: 0 }))).toBe('not_started');
    expect(moduleStateOf(summary({ answered: 3 }))).toBe('in_progress');
    expect(moduleStateOf(summary({ answered: 5 }))).toBe('complete');
  });

  it('does not call an empty module complete', () => {
    expect(moduleStateOf(summary({ answered: 0, total: 0 }))).toBe('not_started');
  });

  it('reads a module B1 has not decided yet as waiting, and one it has ruled out as not applying', () => {
    expect(moduleStateOf(summary({ applicable: false, total: 0, applicabilityCause: cause(null) }))).toBe('waiting');
    expect(moduleStateOf(summary({ applicable: false, total: 0, applicabilityCause: cause('12') }))).toBe(
      'inapplicable',
    );
  });

  it('treats a module ruled out with no single cause as not applying, never as waiting', () => {
    expect(moduleStateOf(summary({ applicable: false, total: 0, applicabilityCause: null }))).toBe('inapplicable');
  });

  it('reads the reporter’s omission before applicability, so a rule never replaces their statement', () => {
    expect(moduleStateOf(summary({ omitted: true, answered: 5 }))).toBe('omitted');
    expect(moduleStateOf(summary({ omitted: true, applicable: false, applicabilityCause: cause('12') }))).toBe(
      'omitted',
    );
  });
});

describe('rollUp', () => {
  it('counts done out of what counts, discounting the omitted and the ruled-out but not the waiting (UX-21)', () => {
    const modules = [
      summary({ module: 'B1', answered: 5 }),
      summary({ module: 'B2', answered: 2 }),
      summary({ module: 'B5', applicable: false, total: 0, applicabilityCause: cause(null) }),
      summary({ module: 'B6', omitted: true }),
      summary({ module: 'B8', applicable: false, total: 0, applicabilityCause: cause('12') }),
    ];

    expect(rollUp(modules)).toEqual({ done: 1, counted: 3, discounted: ['B6', 'B8'], waiting: ['B5'] });
  });

  it('is nothing done out of nothing for an empty group', () => {
    expect(rollUp([])).toEqual({ done: 0, counted: 0, discounted: [], waiting: [] });
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
