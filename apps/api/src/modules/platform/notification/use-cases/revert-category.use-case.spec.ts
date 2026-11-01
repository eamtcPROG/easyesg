import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { FakeCategoryConsoleStore } from '@api/testing/fake-category-console-store';
import { NotificationCategoryChangedError } from '../errors/notification.errors';
import type { CategoryWording } from '../interfaces/category-wording.interface';
import { ListConsoleCategories } from './list-console-categories.use-case';
import { PublishCategory } from './publish-category.use-case';
import { RevertCategory } from './revert-category.use-case';

/** UX-123's one-step revert (task 67.10): the revision before the one in force, published again. Literals: wire values. */
describe('RevertCategory (task 67.10)', () => {
  const { MANUAL_REMINDER, PASSWORD_RESET } = NOTIFICATION_CATEGORY;
  const OPERATOR = '0190a4c2-0000-7000-8000-000000000002';
  const EARLIER = { channels: ['in_app'], classification: 'optional' };
  const LATER = { channels: ['in_app', 'email'], classification: 'optional' };

  const build = (store: FakeCategoryConsoleStore) => {
    const wording: CategoryWording = { worded: () => true, render: ({ locale }) => ({ locale }) };
    const categories = new ListConsoleCategories(store);
    return new RevertCategory(categories, store, new PublishCategory(categories, wording, store));
  };

  it('publishes the previous revision’s behaviour as a new revision, so nothing is erased', async () => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, EARLIER, LATER);

    await expect(
      build(store).execute({ categoryKey: MANUAL_REMINDER, expectedRevision: 2, operatorId: OPERATOR }),
    ).resolves.toEqual({ id: `version-${MANUAL_REMINDER}-3`, revision: 3 });
    expect(store.history.get(MANUAL_REMINDER)?.map((revision) => revision.payload)).toEqual([EARLIER, LATER, EARLIER]);
  });

  // The second revert undoes the first — which is what makes one step safe to press.
  it('reverts a revert back to what it replaced', async () => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, EARLIER, LATER);
    const revert = build(store);

    await revert.execute({ categoryKey: MANUAL_REMINDER, expectedRevision: 2, operatorId: OPERATOR });
    await revert.execute({ categoryKey: MANUAL_REMINDER, expectedRevision: 3, operatorId: OPERATOR });

    expect(store.history.get(MANUAL_REMINDER)?.at(-1)?.payload).toEqual(LATER);
  });

  it('hears a stale screen as changed, rather than reverting what someone else put in force', async () => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, EARLIER, LATER);

    await expect(
      build(store).execute({ categoryKey: MANUAL_REMINDER, expectedRevision: 1, operatorId: OPERATOR }),
    ).rejects.toBeInstanceOf(NotificationCategoryChangedError);
    expect(store.published).toEqual([]);
  });

  it('refuses a revert with nothing before the revision in force', async () => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, LATER);

    await expect(
      build(store).execute({ categoryKey: MANUAL_REMINDER, expectedRevision: 1, operatorId: OPERATOR }),
    ).rejects.toMatchObject({ messageKey: 'platform.notification.category_nothing_to_revert' });
  });

  // A revert is a publication, so it cannot restore what a publication would refuse.
  it('refuses to restore a behaviour the rules now forbid', async () => {
    const store = new FakeCategoryConsoleStore().seed(
      PASSWORD_RESET,
      { channels: ['email', 'in_app'], classification: 'transactional' },
      { channels: ['email'], classification: 'transactional' },
    );

    await expect(
      build(store).execute({ categoryKey: PASSWORD_RESET, expectedRevision: 2, operatorId: OPERATOR }),
    ).rejects.toMatchObject({ messageKey: 'platform.notification.category_refused.address_notice_in_app' });
  });
});
