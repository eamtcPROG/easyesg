import { joinHelp } from './disclosure-help';

describe('joinHelp', () => {
  const documented = { EmployeeTurnoverRate: { text: 'Calculation: …', standing: 'official' as const } };
  const authored = { Turnover: { text: 'Net turnover …', standing: 'platform_authored' as const } };

  it('answers both sources, each entry keeping the standing it was paired with', () => {
    expect(joinHelp({ version: '2026-05-01', locale: 'en', documented, authored })).toEqual({
      EmployeeTurnoverRate: { text: 'Calculation: …', standing: 'official' },
      Turnover: { text: 'Net turnover …', standing: 'platform_authored' },
    });
  });

  it('refuses an element both sources carry, naming it with the version and the locale', () => {
    const overlapping = { ...authored, EmployeeTurnoverRate: { text: 'ours', standing: 'platform_authored' as const } };
    expect(() => joinHelp({ version: '2026-05-01', locale: 'en', documented, authored: overlapping })).toThrow(
      /EmployeeTurnoverRate at 2026-05-01 in en/u,
    );
  });

  it('answers either source alone when the other is empty', () => {
    expect(joinHelp({ version: 'v', locale: 'ro', documented: {}, authored })).toEqual(authored);
    expect(joinHelp({ version: 'v', locale: 'ro', documented, authored: {} })).toEqual(documented);
  });
});
