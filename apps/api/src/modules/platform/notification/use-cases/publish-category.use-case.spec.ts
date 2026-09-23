import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { FakeCategoryConsoleStore } from '@api/testing/fake-category-console-store';
import { NotificationCategoryChangedError, NotificationCategoryRefusedError } from '../errors/notification.errors';
import type { CategoryWording } from '../interfaces/category-wording.interface';
import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { ListConsoleCategories } from './list-console-categories.use-case';
import { PreviewCategoryPublication } from './preview-category-publication.use-case';
import { PublishCategory } from './publish-category.use-case';

/** A-17's preview and publication (task 67.10; §12.5.6's task-67.10 row). */
describe('PreviewCategoryPublication and PublishCategory (task 67.10)', () => {
  const { MANUAL_REMINDER, PASSWORD_RESET } = NOTIFICATION_CATEGORY;
  const { EMAIL, IN_APP } = NOTIFICATION_CHANNEL;
  const { OPTIONAL, TRANSACTIONAL } = NOTIFICATION_CLASSIFICATION;
  const OPERATOR = '0190a4c2-0000-7000-8000-000000000001';

  const build = (options: { unworded?: string } = {}) => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, { channels: [IN_APP, EMAIL], classification: OPTIONAL });
    store.counts.set(MANUAL_REMINDER, { byChannel: { email: 4, in_app: 1 }, people: 4 });
    const wording: CategoryWording = {
      worded: ({ channel }) => channel !== options.unworded,
      render: ({ locale }) => ({ locale }),
    };
    const categories = new ListConsoleCategories(store);
    return {
      store,
      preview: new PreviewCategoryPublication(categories, wording),
      publish: new PublishCategory(categories, wording, store),
    };
  };

  it('previews what a change does for recipients, and writes nothing', async () => {
    const { store, preview } = build();

    await expect(
      preview.execute({ categoryKey: MANUAL_REMINDER, behaviour: { channels: [EMAIL], classification: TRANSACTIONAL } }),
    ).resolves.toEqual([
      { kind: 'switch_offs_overridden', people: 4 },
      { kind: 'channel_removed', channel: 'in_app' },
    ]);
    expect(store.published).toEqual([]);
  });

  it('publishes against the revision read, as the operator', async () => {
    const { store, publish } = build();

    await expect(
      publish.execute({
        categoryKey: MANUAL_REMINDER,
        behaviour: { channels: [EMAIL], classification: OPTIONAL },
        expectedRevision: 1,
        operatorId: OPERATOR,
      }),
    ).resolves.toEqual({ id: `version-${MANUAL_REMINDER}-2`, revision: 2 });
    expect(store.published).toEqual([expect.objectContaining({ expectedRevision: 1, operatorId: OPERATOR })]);
  });

  it('refuses a stale revision rather than overwrite what another operator published', async () => {
    const { store, publish } = build();

    await expect(
      publish.execute({
        categoryKey: MANUAL_REMINDER,
        behaviour: { channels: [EMAIL], classification: OPTIONAL },
        expectedRevision: 0,
        operatorId: OPERATOR,
      }),
    ).rejects.toBeInstanceOf(NotificationCategoryChangedError);
    expect(store.published).toEqual([]);
  });

  // Channel order is not a change: the audit log holds changes, not presses (the task-67.11 row's reading).
  it('refuses the behaviour already in force, in any channel order', async () => {
    const { publish } = build();

    await expect(
      publish.execute({
        categoryKey: MANUAL_REMINDER,
        behaviour: { channels: [EMAIL, IN_APP], classification: OPTIONAL },
        expectedRevision: 1,
        operatorId: OPERATOR,
      }),
    ).rejects.toMatchObject({ messageKey: 'platform.notification.category_unchanged' });
  });

  it.each([
    ['a mandatory category made optional', PASSWORD_RESET, { channels: [EMAIL], classification: OPTIONAL }, 'mandatory_classification'],
    ['a mandatory category without email', PASSWORD_RESET, { channels: [IN_APP], classification: TRANSACTIONAL }, 'mandatory_without_email'],
    ['an address notice in-app', PASSWORD_RESET, { channels: [EMAIL, IN_APP], classification: TRANSACTIONAL }, 'address_notice_in_app'],
  ] as const)('refuses %s, in the preview and the publication alike', async (_, categoryKey, behaviour, refusal) => {
    const { store, preview, publish } = build();
    const key = `platform.notification.category_refused.${refusal}`;

    await expect(preview.execute({ categoryKey, behaviour })).rejects.toMatchObject({ messageKey: key });
    await expect(
      publish.execute({ categoryKey, behaviour, expectedRevision: 0, operatorId: OPERATOR }),
    ).rejects.toBeInstanceOf(NotificationCategoryRefusedError);
    expect(store.published).toEqual([]);
  });

  it('refuses a channel with no wording, so a send can never throw for it', async () => {
    const { publish } = build({ unworded: EMAIL });

    await expect(
      publish.execute({
        categoryKey: MANUAL_REMINDER,
        behaviour: { channels: [EMAIL], classification: OPTIONAL },
        expectedRevision: 1,
        operatorId: OPERATOR,
      }),
    ).rejects.toMatchObject({ messageKey: 'platform.notification.category_refused.wording_missing' });
  });
});
