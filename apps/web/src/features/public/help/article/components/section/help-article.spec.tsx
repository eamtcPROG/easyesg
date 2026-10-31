import { API_OUTCOME, type HelpArticle as HelpArticleRead } from '@easyesg/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readHelpArticle } from '@/server/data/help-content';
import { HelpArticle } from './help-article';

/**
 * S-33's article in the language it came in (task 77; UC-181; WCAG 2.2 3.1.2): an article the store holds only in
 * Romanian is served to an English reader in Romanian, and every part of it — the eyebrow, the title, the lede, each
 * heading and each body — says so in `lang`, while the page's own words around it stay in the page's language. The
 * browser suite cannot reach this arm: every seeded article is written in all three languages.
 */
vi.mock('@/server/data/help-content', () => ({ readHelpArticle: vi.fn() }));
vi.mock('next-intl/server', () => ({ getTranslations: () => Promise.resolve((key: string) => key) }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={String(href)}>{children}</a>,
}));
// Both read their own words, which an async component cannot do under a client render; each is drawn on its own.
vi.mock('../next/article-read-next', () => ({ READ_NEXT_ID: 'read-next', ArticleReadNext: () => null }));
vi.mock('../states/article-unavailable', () => ({ ArticleUnavailable: () => <p>unavailable</p> }));

const read = vi.mocked(readHelpArticle);

const ARTICLE: HelpArticleRead = {
  key: 'energy',
  topic: 'figures',
  locale: 'ro',
  module: 'B3',
  title: 'Facturile de energie',
  summary: 'Pe scurt.',
  sections: [
    { heading: 'Pe scurt', body: 'Calculul **începe** din facturi.', disclosed: false },
    { heading: 'Pragurile', body: 'Un detaliu.', disclosed: true },
  ],
  related: [],
};

const draw = async (locale: 'ro' | 'en') => render(await HelpArticle({ articleKey: 'energy', locale }));

afterEach(() => vi.clearAllMocks());

describe('HelpArticle (S-33; task 77)', () => {
  it('marks every part of an article that fell back to Romanian, and none of the page’s own words', async () => {
    read.mockResolvedValue({ status: API_OUTCOME.Ok, value: ARTICLE, messages: [] });
    await draw('en');

    for (const words of ['B3', 'Facturile de energie', 'Pe scurt.']) {
      expect(screen.getByText(words).closest('[lang]')).toHaveAttribute('lang', 'ro');
    }
    expect(screen.getByRole('heading', { name: 'Pe scurt' }).querySelector('[lang="ro"]')).not.toBeNull();
    expect(screen.getByText('începe').closest('[lang]')).toHaveAttribute('lang', 'ro');
    // A disclosed section's body is in the article's language too, inside its disclosure.
    expect(screen.getByText('Un detaliu.').closest('[lang]')).toHaveAttribute('lang', 'ro');
    // The page's words are not the article's: the contents' label and the way back carry no marking.
    // Two lists, docked and disclosed, one hidden per frame by the stylesheet jsdom does not apply.
    const contents = screen.getAllByRole('navigation', { name: 'contents' });
    expect(contents).toHaveLength(2);
    for (const list of contents) expect(list.closest('[lang]')).toBeNull();
    expect(screen.getByRole('link', { name: 'back' }).closest('[lang]')).toBeNull();
  });

  it('marks nothing where the article is in the page’s language', async () => {
    read.mockResolvedValue({ status: API_OUTCOME.Ok, value: ARTICLE, messages: [] });
    const { container } = await draw('ro');
    expect(container.querySelector('[lang]')).toBeNull();
  });

  it('answers the not-found surface for an article the library does not hold', async () => {
    read.mockResolvedValue({ status: API_OUTCOME.Problem, problem: { type: 'about:blank', status: 404 } });
    await expect(draw('ro')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('draws its unavailable state for any other failed read', async () => {
    read.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    await draw('ro');
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });
});
