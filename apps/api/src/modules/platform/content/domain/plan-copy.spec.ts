import { planCopyRefusal, readPlanCopy } from './plan-copy';

const COPY = {
  order: 1,
  locales: {
    ro: { name: 'Standard', summary: 'Mai mulți colegi.', highlights: ['Până la cinci entități'], badge: 'Cel mai ales' },
    en: { name: 'Standard', summary: 'Several colleagues.', highlights: [] },
  },
};

describe('readPlanCopy', () => {
  it('reads a plan’s copy whole, a missing badge as none', () => {
    expect(readPlanCopy(COPY)).toEqual({
      order: 1,
      text: {
        source: COPY.locales.ro,
        byLocale: { ro: COPY.locales.ro, en: { ...COPY.locales.en, badge: null } },
      },
    });
  });

  it('reads a badge given as null as none', () => {
    const copy = { ...COPY, locales: { ro: { ...COPY.locales.ro, badge: null } } };
    expect(readPlanCopy(copy)?.text.source.badge).toBeNull();
  });
});

describe('planCopyRefusal', () => {
  it('admits copy the reader reads', () => {
    expect(planCopyRefusal(COPY)).toBeNull();
  });

  it.each([
    [{ ...COPY, locales: { ro: { ...COPY.locales.ro, name: '' } } }, 'in ro: its name is blank'],
    [{ ...COPY, locales: { ro: { ...COPY.locales.ro, highlights: 'Five' } } }, 'in ro: its highlights: is not a list'],
    [{ ...COPY, locales: { ro: { ...COPY.locales.ro, badge: ' ' } } }, 'in ro: its badge is blank'],
  ])('refuses %j: %s', (payload, fault) => {
    expect(planCopyRefusal(payload)).toEqual(`plan copy the reader would not read: ${fault}`);
  });
});
