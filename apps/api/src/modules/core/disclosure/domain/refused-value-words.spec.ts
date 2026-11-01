import { LABEL_STANDING } from '@easyesg/i18n';
import { UnknownDisclosureDimensionError } from '../errors/report.errors';
import { wordRefusedValues } from './refused-value-words';

/** Task 218: a refused value named as the banner names it — its field and member in the reader's language. */
const label = (text: string) => ({ text, standing: LABEL_STANDING.OFFICIAL });
const refusal = new UnknownDisclosureDimensionError();
const words = () => ({ type: 'https://easyesg.md/problems/validation-failed', title: 'Title', detail: 'Detail' });

describe('wordRefusedValues', () => {
  it('names the field and its member, with the refusal worded and the modules kept', () => {
    const [named] = wordRefusedValues({
      refused: [
        {
          key: { elementKey: 'AmountOfEmissionToAir', dimensionKey: 'AlachlorMember', ordinal: 0 },
          modules: ['B4'],
          refusal,
        },
      ],
      labels: { AmountOfEmissionToAir: label('Emisii în aer') },
      members: { AlachlorMember: label('Alaclor') },
      words,
    });
    expect(named).toEqual({
      type: 'https://easyesg.md/problems/validation-failed',
      title: 'Title',
      detail: 'Detail',
      elementKey: 'AmountOfEmissionToAir',
      dimensionKey: 'AlachlorMember',
      ordinal: 0,
      modules: ['B4'],
      label: 'Emisii în aer',
      memberLabel: 'Alaclor',
    });
  });

  it('names no member on an undimensioned field, and nothing the version does not word', () => {
    const [named] = wordRefusedValues({
      refused: [{ key: { elementKey: 'NotAnElement', dimensionKey: '', ordinal: 0 }, modules: [], refusal }],
      labels: {},
      members: {},
      words,
    });
    expect(named?.label).toBeNull();
    expect(named?.memberLabel).toBeNull();
  });
});
