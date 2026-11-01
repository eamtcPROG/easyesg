import { describe, expect, it } from 'vitest';
import type { LegalControllerRecord } from '@easyesg/contracts';
import {
  IDNO_FIELD_VERDICT,
  idnoFieldVerdict,
  legalControllerFieldsOf,
  publicationRequestOf,
} from './legal-controller-fields';

const RECORD: LegalControllerRecord = {
  registeredName: 'EasyESG SRL',
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
  revision: 2,
  changedByEmail: null,
  changedAt: null,
};

describe('A-21’s form and the wire (task 75)', () => {
  it('opens on the four facts in force and saves them against the revision it opened on', () => {
    const fields = legalControllerFieldsOf(RECORD);

    expect(fields).toEqual({
      registeredName: 'EasyESG SRL',
      idno: '1099600012345',
      registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
      dataProtectionEmail: 'privacy@easyesg.md',
    });
    expect(publicationRequestOf({ fields: { ...fields, registeredName: ' Other SRL ' }, revision: 2 })).toEqual({
      ...fields,
      registeredName: ' Other SRL ',
      revision: 2,
    });
  });

  it('judges an IDNO by its shape and then its check digit, as the api does', () => {
    expect(idnoFieldVerdict(' 1099600012345 ')).toBe(IDNO_FIELD_VERDICT.VALID);
    expect(idnoFieldVerdict('109960001234')).toBe(IDNO_FIELD_VERDICT.MALFORMED);
    expect(idnoFieldVerdict('10996000123A5')).toBe(IDNO_FIELD_VERDICT.MALFORMED);
    expect(idnoFieldVerdict('1099600012346')).toBe(IDNO_FIELD_VERDICT.CHECK_DIGIT);
  });
});
