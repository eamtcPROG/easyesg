import { CELL_VALUE_KIND } from '@easyesg/xlsx-patch';
import { TEMPLATE_ENCODING } from '@api/contracts/digital-template-map';
import { cellValueOf } from './workbook-value';

const lists = { ListOfUndertakingsLegalFormsMember: { 'vsme:CooperativeMember': 'cooperative' } };

/** How an answer is spelled in a template cell (task 46.1; NFR-70). */
describe('an answer as a template cell takes it', () => {
  it('writes a number, text and a TRUE/FALSE cell as themselves', () => {
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.NUMBER }, answer: { number: '12.5' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.NUMBER,
      value: '12.5',
    });
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.BOOLEAN }, answer: { yes: false }, lists })).toEqual({
      kind: CELL_VALUE_KIND.BOOLEAN,
      value: false,
    });
  });

  it('writes a reporter’s text that opens like a formula as the words they typed (NFR-70; FR-50 AC-9)', () => {
    expect(cellValueOf({ encoding: { as: TEMPLATE_ENCODING.TEXT }, answer: { text: '=HYPERLINK("x")' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.TEXT,
      value: '=HYPERLINK("x")',
    });
  });

  it('writes a yes/no in EFRAG’s own words where its dropdown asks for them', () => {
    const encoding = { as: TEMPLATE_ENCODING.WORDS, true: 'YES', false: 'NO' } as const;
    expect(cellValueOf({ encoding, answer: { yes: true }, lists })).toEqual({ kind: CELL_VALUE_KIND.TEXT, value: 'YES' });
    expect(cellValueOf({ encoding, answer: { yes: false }, lists })).toEqual({ kind: CELL_VALUE_KIND.TEXT, value: 'NO' });
  });

  it('writes a member as EFRAG’s dropdown string, and names one the list does not hold', () => {
    const encoding = { as: TEMPLATE_ENCODING.LIST, list: 'ListOfUndertakingsLegalFormsMember' } as const;
    expect(cellValueOf({ encoding, answer: { member: 'vsme:CooperativeMember' }, lists })).toEqual({
      kind: CELL_VALUE_KIND.TEXT,
      value: 'cooperative',
    });
    expect(cellValueOf({ encoding, answer: { member: 'vsme:NoSuchMember' }, lists })).toEqual({ unlisted: 'vsme:NoSuchMember' });
  });

  it('refuses an answer of one shape under an encoding of another — a defect in the map', () => {
    expect(() => cellValueOf({ encoding: { as: TEMPLATE_ENCODING.NUMBER }, answer: { text: 'twelve' }, lists })).toThrow();
  });
});
