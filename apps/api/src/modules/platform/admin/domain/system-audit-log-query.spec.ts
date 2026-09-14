import { toSystemAuditLogQuery } from './system-audit-log-query';

const base = {
  list: { skip: 50, take: 25 },
  operator: undefined,
  action: undefined,
  from: undefined,
  to: undefined,
  fallbackTake: 25,
};

describe('A-08’s log filters (task 67.4)', () => {
  it('reads an operator, an action and two instants', () => {
    expect(
      toSystemAuditLogQuery({
        ...base,
        operator: '01920000-0000-7000-8000-000000000001',
        action: 'admin.account.suspended',
        from: '1789862400000',
        to: '1789948800000',
      }),
    ).toEqual({
      operatorId: '01920000-0000-7000-8000-000000000001',
      action: 'admin.account.suspended',
      from: new Date(1_789_862_400_000),
      to: new Date(1_789_948_800_000),
      skip: 50,
      take: 25,
    });
  });

  it('drops what it does not understand rather than refusing the read', () => {
    expect(
      toSystemAuditLogQuery({
        ...base,
        operator: 'not-a-uuid',
        action: 'admin.account.deleted',
        from: '2026-09-13',
        to: '-1',
      }),
    ).toMatchObject({ operatorId: null, action: null, from: null, to: null });
  });

  it('takes nothing but strings — a repeated parameter arrives as an array and is dropped', () => {
    expect(
      toSystemAuditLogQuery({
        ...base,
        operator: ['01920000-0000-7000-8000-000000000001'],
        from: ['1789862400000'],
      }),
    ).toMatchObject({ operatorId: null, from: null });
  });

  it('never skips a negative count and falls back to one page when no size arrived', () => {
    expect(toSystemAuditLogQuery({ ...base, list: { skip: -10, take: undefined } })).toMatchObject({
      skip: 0,
      take: 25,
    });
  });
});
