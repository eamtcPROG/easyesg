import { CELL_TARGET } from '@easyesg/xlsx-patch';
import { TEMPLATE_GATE, type TemplateGateAnswer } from '@api/contracts/digital-template-map';
import { gateIsAffirmed, type HeldAnswers } from './workbook-gates';

const gate = (answer: TemplateGateAnswer, when: string[]) => ({ at: { kind: CELL_TARGET.ADDRESS, sheet: 'S', cell: 'A1' }, when, answer });
const held = (elementKey: string, answers: HeldAnswers['answers'], dimensionKey = ''): HeldAnswers => ({ elementKey, dimensionKey, answers });

describe('gateIsAffirmed', () => {
  it('answers a held gate yes when any element of its group is held, whatever it holds', () => {
    const certification = gate(TEMPLATE_GATE.HELD, ['Description']);
    expect(gateIsAffirmed({ gate: certification, held: [held('Description', [{ text: 'EU Ecolabel' }])] })).toBe(true);
    expect(gateIsAffirmed({ gate: certification, held: [held('Other', [{ text: 'x' }])] })).toBe(false);
    expect(gateIsAffirmed({ gate: certification, held: [] })).toBe(false);
  });

  it('answers an affirmed gate yes only for a yes or a figure above zero', () => {
    const sites = gate(TEMPLATE_GATE.AFFIRMED, ['In', 'Near', 'Area']);
    expect(gateIsAffirmed({ gate: sites, held: [held('In', [{ yes: false }], '1'), held('Near', [{ yes: false }], '1')] })).toBe(false);
    expect(gateIsAffirmed({ gate: sites, held: [held('In', [{ yes: false }], '1'), held('Near', [{ yes: true }], '2')] })).toBe(true);
    expect(gateIsAffirmed({ gate: sites, held: [held('Area', [{ number: '0.00' }])] })).toBe(false);
    expect(gateIsAffirmed({ gate: sites, held: [held('Area', [{ number: '0.05' }])] })).toBe(true);
    expect(gateIsAffirmed({ gate: sites, held: [held('Area', [{ number: '-3' }])] })).toBe(false);
  });

  it('reads a nil return for convictions and fines as no', () => {
    const fines = gate(TEMPLATE_GATE.AFFIRMED, ['Convictions', 'Fines']);
    expect(gateIsAffirmed({ gate: fines, held: [held('Convictions', [{ number: '0' }]), held('Fines', [{ number: '0' }])] })).toBe(false);
    expect(gateIsAffirmed({ gate: fines, held: [held('Convictions', [{ number: '0' }]), held('Fines', [{ number: '1500' }])] })).toBe(true);
  });

  it('answers a several gate yes only for more than one member', () => {
    const countries = gate(TEMPLATE_GATE.SEVERAL, ['Employees']);
    expect(gateIsAffirmed({ gate: countries, held: [held('Employees', [{ number: '50' }], 'MD')] })).toBe(false);
    expect(gateIsAffirmed({ gate: countries, held: [held('Employees', [{ number: '40' }], 'MD'), held('Employees', [{ number: '10' }], 'RO')] })).toBe(true);
  });
});
