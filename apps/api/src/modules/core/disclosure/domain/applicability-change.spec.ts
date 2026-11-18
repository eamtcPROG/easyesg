import { applicabilityMoved } from './applicability-change';

const verdicts = (entries: Record<string, boolean>) => new Map(Object.entries(entries));

describe('applicabilityMoved (task 67.8; 182/135)', () => {
  it('is moved where the same answers now make a field apply, or stop applying', () => {
    expect(applicabilityMoved({ before: verdicts({ EmployeeTurnoverRate: false }), after: verdicts({ EmployeeTurnoverRate: true }) })).toBe(true);
    expect(applicabilityMoved({ before: verdicts({ EmployeeTurnoverRate: true }), after: verdicts({ EmployeeTurnoverRate: false }) })).toBe(true);
  });

  it('is not moved where the verdicts agree, a threshold having moved past no answer', () => {
    expect(applicabilityMoved({ before: verdicts({ EmployeeTurnoverRate: true }), after: verdicts({ EmployeeTurnoverRate: true }) })).toBe(false);
  });

  it('reads a field no rule governs as applying, so a rule that agrees with that changes nothing', () => {
    expect(applicabilityMoved({ before: verdicts({}), after: verdicts({ Water: true }) })).toBe(false);
    expect(applicabilityMoved({ before: verdicts({}), after: verdicts({ Water: false }) })).toBe(true);
  });
});
