import {
  LEGAL_CONTROLLER_FAULT,
  type LegalController,
  legalControllerFault,
  legalControllerRefusal,
  legalControllersAreEqual,
  readLegalController,
} from './legal-controller';

const CONTROLLER: LegalController = {
  registeredName: 'EasyESG SRL',
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
};

describe('legalControllerFault', () => {
  it('finds nothing wrong with a complete controller', () => {
    expect(legalControllerFault(CONTROLLER)).toBeNull();
  });

  it.each([
    [{ registeredName: '' }, LEGAL_CONTROLLER_FAULT.NAME_MISSING],
    [{ idno: '' }, LEGAL_CONTROLLER_FAULT.IDNO_MISSING],
    [{ idno: '109960001234' }, LEGAL_CONTROLLER_FAULT.IDNO_MALFORMED],
    [{ idno: '1099600012346' }, LEGAL_CONTROLLER_FAULT.IDNO_CHECK_DIGIT],
    [{ registeredAddress: '' }, LEGAL_CONTROLLER_FAULT.ADDRESS_MISSING],
    [{ dataProtectionEmail: '' }, LEGAL_CONTROLLER_FAULT.EMAIL_MISSING],
    [{ dataProtectionEmail: 'privacy at easyesg' }, LEGAL_CONTROLLER_FAULT.EMAIL_MALFORMED],
  ])('names %j as %s', (change, fault) => {
    expect(legalControllerFault({ ...CONTROLLER, ...change })).toBe(fault);
  });

  it('names the first fault in the order the fields are laid out', () => {
    expect(legalControllerFault({ ...CONTROLLER, registeredName: '', dataProtectionEmail: '' })).toBe(
      LEGAL_CONTROLLER_FAULT.NAME_MISSING,
    );
  });
});

describe('readLegalController', () => {
  it('reads a complete payload, trimmed', () => {
    expect(readLegalController({ ...CONTROLLER, registeredName: '  EasyESG SRL ' })).toEqual(CONTROLLER);
  });

  it.each([
    ['nothing', null],
    ['a list', [CONTROLLER]],
    ['a missing field', { ...CONTROLLER, idno: undefined }],
    ['a number for the IDNO', { ...CONTROLLER, idno: 1099600012345 }],
    ['a blank address', { ...CONTROLLER, registeredAddress: '   ' }],
    ['a wrong check digit', { ...CONTROLLER, idno: '1099600012346' }],
  ])('reads %s as no controller', (_, payload) => {
    expect(readLegalController(payload)).toBeNull();
  });
});

describe('legalControllerRefusal', () => {
  it('admits what the reader reads, and refuses what it does not', () => {
    expect(legalControllerRefusal(CONTROLLER)).toBeNull();
    expect(legalControllerRefusal({ ...CONTROLLER, dataProtectionEmail: 'nobody' })).toEqual(expect.any(String));
  });
});

describe('legalControllersAreEqual', () => {
  it('compares every field', () => {
    expect(legalControllersAreEqual({ a: CONTROLLER, b: { ...CONTROLLER } })).toBe(true);
    for (const field of Object.keys(CONTROLLER) as (keyof LegalController)[]) {
      expect(legalControllersAreEqual({ a: CONTROLLER, b: { ...CONTROLLER, [field]: 'x' } })).toBe(false);
    }
  });
});
