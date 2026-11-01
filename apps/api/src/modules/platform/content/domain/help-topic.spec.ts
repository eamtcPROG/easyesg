import { helpTopicRefusal, readHelpTopic } from './help-topic';

const TOPIC = {
  order: 1,
  locales: {
    ro: { title: 'Primul raport', summary: 'Ce trebuie strâns înainte de a începe.' },
    ru: { title: 'Первый отчёт', summary: 'Что собрать, прежде чем начать.' },
  },
};

describe('readHelpTopic', () => {
  it('reads a topic whole', () => {
    expect(readHelpTopic(TOPIC)).toEqual({
      order: 1,
      text: { source: TOPIC.locales.ro, byLocale: TOPIC.locales },
    });
  });

  it('reads nothing of a topic it refuses', () => {
    expect(readHelpTopic({ ...TOPIC, locales: {} })).toBeNull();
  });
});

describe('helpTopicRefusal', () => {
  it('admits a topic the reader reads', () => {
    expect(helpTopicRefusal(TOPIC)).toBeNull();
  });

  it.each([
    [{ ...TOPIC, order: 'first' }, 'its order is not a whole number of at least zero'],
    [{ ...TOPIC, locales: { ro: { title: 'Primul raport' } } }, 'in ro: its summary is blank'],
    [[], 'is not an object'],
  ])('refuses %j: %s', (payload, fault) => {
    expect(helpTopicRefusal(payload)).toEqual(`a help topic the reader would not read: ${fault}`);
  });
});
