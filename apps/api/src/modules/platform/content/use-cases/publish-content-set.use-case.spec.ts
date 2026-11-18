import { CONTENT_KIND } from '../constants/content.constants';
import { ContentDraftMissingError, ContentSignOffMissingError } from '../errors/content.errors';
import type { ContentConsoleStore, ContentSignOff } from '../interfaces/content-console-store.interface';
import { CONTENT_DRAFT_STATE, type ContentDraftState, type ContentItem } from '../models/content-console.model';
import { PublishContentSet } from './publish-content-set.use-case';

const AT = new Date('2026-11-18T10:00:00Z');
const OPERATOR = '01920000-0000-7000-8000-0000000000aa';
const block = { title: 'T', summary: 'S.' };

const item = (
  key: string,
  locales: Record<string, unknown>,
  state: ContentDraftState = CONTENT_DRAFT_STATE.IN_REVIEW,
): ContentItem => ({
  kind: CONTENT_KIND.HELP_TOPIC,
  key,
  inForce: null,
  draft: {
    id: `draft-${key}`,
    revision: 1,
    state,
    payload: { order: 1, locales },
    draftedAt: AT,
    draftedBy: null,
  },
});

const storeWith = (items: readonly ContentItem[]) => {
  const published: { items: unknown; signOff: Readonly<Record<string, ContentSignOff>> }[] = [];
  const store = {
    items: () => Promise.resolve(items),
    publishReviewed: (input: { items: unknown; signOff: Readonly<Record<string, ContentSignOff>> }) => {
      published.push(input);
      return Promise.resolve({ publicationId: 'publication-1' });
    },
  } as unknown as ContentConsoleStore;
  return { store, published };
};

describe('PublishContentSet (task 67.5; FR-62, NFR-23)', () => {
  const refs = [
    { kind: CONTENT_KIND.HELP_TOPIC, key: 'a' },
    { kind: CONTENT_KIND.HELP_TOPIC, key: 'b' },
  ];

  it('records a sign-off for every locale any item carries, by the operator, at the clock’s time', async () => {
    const { store, published } = storeWith([item('a', { ro: block }), item('b', { ro: block, en: block })]);
    const answer = await new PublishContentSet(store, () => AT).execute({
      items: refs,
      signedOff: ['ro', 'en', 'ru'],
      operatorId: OPERATOR,
    });
    expect(answer).toEqual({ id: 'publication-1' });
    expect(published[0].signOff).toEqual({ ro: { by: OPERATOR, at: AT }, en: { by: OPERATOR, at: AT } });
  });

  it('refuses a set whose sign-off leaves out a locale it carries, publishing nothing', async () => {
    const { store, published } = storeWith([item('a', { ro: block }), item('b', { ro: block, en: block })]);
    await expect(
      new PublishContentSet(store, () => AT).execute({ items: refs, signedOff: ['ro'], operatorId: OPERATOR }),
    ).rejects.toBeInstanceOf(ContentSignOffMissingError);
    expect(published).toEqual([]);
  });

  it('refuses an item whose draft is not in review', async () => {
    const { store } = storeWith([item('a', { ro: block }), item('b', { ro: block }, CONTENT_DRAFT_STATE.DRAFT)]);
    await expect(
      new PublishContentSet(store, () => AT).execute({ items: refs, signedOff: ['ro'], operatorId: OPERATOR }),
    ).rejects.toBeInstanceOf(ContentDraftMissingError);
  });
});
