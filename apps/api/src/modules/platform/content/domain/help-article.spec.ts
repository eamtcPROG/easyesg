import { helpArticleRefusal, readHelpArticle } from './help-article';

const text = (title: string) => ({
  title,
  summary: 'Ce întreabă fiecare secțiune.',
  module: 'B1 · Baza de întocmire',
  sections: [
    { heading: 'Pe scurt', body: 'Unsprezece secțiuni.', disclosed: false },
    { heading: 'Exemplu', body: '- o brutărie\n- un atelier', disclosed: true },
  ],
});

const ARTICLE = {
  topic: 'first-report',
  order: 2,
  related: ['locking-a-period'],
  locales: { ro: text('Ce cere VSME'), en: { ...text('What VSME asks'), module: 'B1 · Basis for preparation' } },
};

describe('readHelpArticle', () => {
  it('reads an article whole: its topic, its place, what to read next and each locale’s sections', () => {
    expect(readHelpArticle(ARTICLE)).toEqual({
      topic: 'first-report',
      order: 2,
      related: ['locking-a-period'],
      text: {
        source: ARTICLE.locales.ro,
        byLocale: { ro: ARTICLE.locales.ro, en: ARTICLE.locales.en },
      },
    });
  });

  it('reads an article that names nothing to read next', () => {
    const { related: _related, ...rest } = ARTICLE;
    expect(readHelpArticle(rest)?.related).toEqual([]);
  });

  it('reads nothing of an article it refuses', () => {
    expect(readHelpArticle({ ...ARTICLE, order: -1 })).toBeNull();
  });
});

describe('helpArticleRefusal', () => {
  it('admits an article the reader reads', () => {
    expect(helpArticleRefusal(ARTICLE)).toBeNull();
  });

  it.each([
    [{ ...ARTICLE, topic: '' }, 'its topic is not a key'],
    [{ ...ARTICLE, related: ['ok', 4] }, 'its articles to read next: entry 2 is not a key'],
    [{ ...ARTICLE, locales: { en: ARTICLE.locales.en } }, 'carries no ro text'],
    [{ ...ARTICLE, locales: { ro: { ...text('Titlu'), sections: [] } } }, 'in ro: has no section'],
    [{ ...ARTICLE, locales: { ro: { ...text('Titlu'), module: ' ' } } }, 'in ro: its module is blank'],
    [
      { ...ARTICLE, locales: { ro: { ...text('Titlu'), sections: [{ heading: 'A', body: 'B' }] } } },
      'in ro: its section 1 does not say whether it is disclosed',
    ],
    [
      { ...ARTICLE, locales: { ro: { ...text('Titlu'), sections: [{ heading: 'A', body: '<p>B</p>', disclosed: false }] } } },
      'in ro: its section 1 its body carries an HTML tag',
    ],
    [{ ...ARTICLE, locales: { ro: text('Vezi FR-61') } }, 'in ro: its title carries a specification identifier'],
  ])('refuses %j: %s', (payload, fault) => {
    expect(helpArticleRefusal(payload)).toEqual(expect.stringContaining(fault));
  });
});
