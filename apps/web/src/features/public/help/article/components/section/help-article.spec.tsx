import { API_OUTCOME } from '@easyesg/contracts';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readHelpArticle, readHelpTopics } from '@/server/data/help-content';
import { HelpArticle } from './help-article';

/**
 * S-33's arms (tasks 77, 227): an article the library does not hold answers the not-found surface, any other failed
 * read the unavailable state, and a read article is read in the help's language the address chose (`architecture.md`
 * §12.5.6's task-227 row (2)) — with the account card for a visitor alone. The parts each read their own words, which
 * an async component cannot do under a client render, so each is drawn by a stand-in here and specified on its own.
 */
vi.mock('@/server/data/help-content', () => ({ readHelpArticle: vi.fn(), readHelpTopics: vi.fn() }));
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));
vi.mock('../bar/article-bar', () => ({ ArticleBar: () => <nav>bar</nav> }));
vi.mock('../body/article-card', () => ({
  ArticleCard: ({ lang }: { lang: string | undefined }) => <article>card {lang ?? 'page'}</article>,
}));
vi.mock('../side/article-contents', () => ({ ArticleContents: () => null }));
vi.mock('../side/article-applies-to', () => ({ ArticleAppliesTo: () => null }));
vi.mock('../rail/article-read-next', () => ({ ArticleReadNext: () => null }));
vi.mock('../rail/still-not-sure', () => ({ StillNotSure: () => null }));
vi.mock('../../../shared/help-account-card', () => ({ HelpAccountCard: () => <p>account card</p> }));
vi.mock('../states/article-unavailable', () => ({ ArticleUnavailable: () => <p>unavailable</p> }));

const readArticle = vi.mocked(readHelpArticle);
const readTopics = vi.mocked(readHelpTopics);

const ARTICLE = {
  key: 'energy',
  topic: 'figures',
  locale: 'ro' as const,
  module: 'B3',
  title: 'Facturile de energie',
  summary: 'Pe scurt.',
  sections: [],
  related: [],
};

const draw = async (input: { requestedContent?: string; signedIn?: boolean }) =>
  render(
    await HelpArticle({
      articleKey: 'energy',
      page: 'en',
      requestedContent: input.requestedContent,
      signedIn: input.signedIn ?? false,
    }),
  );

afterEach(() => vi.clearAllMocks());

describe('HelpArticle (S-33; tasks 77, 227)', () => {
  it('reads the article in the help’s language the address chose, and marks it where it is not the page’s', async () => {
    readArticle.mockResolvedValue({ status: API_OUTCOME.Ok, value: ARTICLE, messages: [] });
    readTopics.mockResolvedValue({ status: API_OUTCOME.Problem, problem: { type: 'about:blank', status: 500 } });
    await draw({ requestedContent: 'ro' });

    expect(readArticle).toHaveBeenCalledWith('energy', 'ro');
    expect(screen.getByRole('article')).toHaveTextContent('card ro');
  });

  it('reads it in the page’s language where the address names none, or one not published', async () => {
    readArticle.mockResolvedValue({ status: API_OUTCOME.Ok, value: { ...ARTICLE, locale: 'en' }, messages: [] });
    readTopics.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    await draw({ requestedContent: 'de' });

    expect(readArticle).toHaveBeenCalledWith('energy', 'en');
    expect(screen.getByRole('article')).toHaveTextContent('card page');
  });

  it('offers a visitor the account card, and a signed-in reader none', async () => {
    readArticle.mockResolvedValue({ status: API_OUTCOME.Ok, value: ARTICLE, messages: [] });
    readTopics.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    const visitor = await draw({});
    expect(screen.getByText('account card')).toBeInTheDocument();
    visitor.unmount();

    await draw({ signedIn: true });
    expect(screen.queryByText('account card')).toBeNull();
  });

  it('answers the not-found surface for an article the library does not hold', async () => {
    readArticle.mockResolvedValue({ status: API_OUTCOME.Problem, problem: { type: 'about:blank', status: 404 } });
    readTopics.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    await expect(draw({})).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('draws its unavailable state for any other failed read', async () => {
    readArticle.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    readTopics.mockResolvedValue({ status: API_OUTCOME.Unreachable });
    await draw({});
    expect(screen.getByText('unavailable')).toBeInTheDocument();
  });
});
