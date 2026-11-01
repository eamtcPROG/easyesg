import type { HelpArticle } from '@easyesg/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ArticleCard } from './article-card';

/**
 * S-33's article in the language it came in (tasks 77, 227; UC-181; WCAG 2.2 3.1.2): an article the store holds only
 * in Romanian is served to an English reader in Romanian, and every part of it — the module, the title, the short
 * answer, each heading and each body — says so in `lang`, while the page's own words around it stay in the page's
 * language. The browser suite cannot reach this arm: every seeded article is written in all three languages.
 */
vi.mock('next-intl/server', () => ({ getTranslations: () => Promise.resolve((key: string) => key) }));

const ARTICLE: HelpArticle = {
  key: 'energy',
  topic: 'figures',
  locale: 'ro',
  module: 'B3',
  title: 'Facturile de energie',
  summary: 'Pe scurt.',
  sections: [
    { heading: 'Pragurile', body: 'Calculul **începe** din facturi.', disclosed: false },
    { heading: 'Detaliul', body: 'Un detaliu.', disclosed: true },
  ],
  related: [],
};

describe('ArticleCard (S-33; tasks 77, 227)', () => {
  it('marks every part of an article that fell back to Romanian, and none of the page’s own words', async () => {
    render(await ArticleCard({ article: ARTICLE, lang: 'ro' }));

    for (const words of ['B3', 'Facturile de energie', 'Pe scurt.', 'Pragurile', 'Detaliul', 'Un detaliu.']) {
      expect(screen.getByText(words).closest('[lang]')).toHaveAttribute('lang', 'ro');
    }
    expect(screen.getByText('începe').closest('[lang]')).toHaveAttribute('lang', 'ro');
    // The page's words are not the article's: the short answer's name and the disclosed row's *Show*.
    expect(screen.getByRole('heading', { name: 'shortAnswer' }).closest('[lang]')).toBeNull();
    expect(screen.getByText('show').closest('[lang]')).toBeNull();
  });

  it('marks nothing where the article is in the page’s language', async () => {
    const { container } = render(await ArticleCard({ article: ARTICLE, lang: undefined }));
    expect(container.querySelector('[lang]')).toBeNull();
  });

  it('puts the summary above the sections as the short answer, and draws a disclosed section as a row to open', async () => {
    render(await ArticleCard({ article: ARTICLE, lang: undefined }));

    const answer = screen.getByRole('heading', { name: 'shortAnswer' }).parentElement;
    expect(answer).toHaveTextContent('Pe scurt.');
    // A heading, never a landmark: a region would share its name with a section an editor heads the same way.
    expect(screen.queryByRole('region', { name: 'shortAnswer' })).toBeNull();
    expect(answer?.compareDocumentPosition(screen.getByRole('heading', { name: 'Pragurile' }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const disclosed = screen.getByText('Un detaliu.').closest('details');
    expect(disclosed).not.toBeNull();
    expect(disclosed).not.toHaveAttribute('open');
    expect(disclosed?.querySelector('summary h2')).toHaveTextContent('Detaliul');
  });
});
