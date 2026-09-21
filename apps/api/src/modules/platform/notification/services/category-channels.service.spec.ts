import { Logger } from '@nestjs/common';
import { NOTIFICATION_CATEGORY, type NotificationCategoryKey } from '@api/contracts/notification.port';
import type { NotificationCategoryBehaviour } from '../models/notification-category.model';
import { CategoryChannels } from './category-channels.service';
import type { NotificationCategoryCatalog } from './notification-category-catalog.service';

/**
 * The channels a notice goes out on, and the owner's rule for when its category's behaviour cannot be read (task
 * 49.3). Literals on purpose: they are what an operator publishes.
 */
describe('CategoryChannels (tasks 49.3, 50.1.1)', () => {
  const channels = (behaviour: NotificationCategoryBehaviour | null) =>
    new CategoryChannels({ behaviourOf: () => behaviour } as unknown as NotificationCategoryCatalog);

  /**
   * **An optional category is reached with a key the vocabulary will hold one day** — categories arrive with their
   * producers. The cast is the whole of it: the rule is keyed on membership of the mandatory set, which is what is
   * under test.
   */
  const optional = 'billing.trial_ending' as NotificationCategoryKey;

  let warned: string[] = [];
  beforeEach(() => {
    warned = [];
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((message: unknown) => {
      warned.push(String(message));
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('answers the channels a readable behaviour names, quietly', () => {
    expect(
      channels({ channels: ['email'], classification: 'transactional' }).channelsFor({
        categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      }),
    ).toEqual(['email']);
    expect(warned).toEqual([]);
  });

  it.each(Object.values(NOTIFICATION_CATEGORY))(
    'sends mandatory %s by email when its behaviour cannot be read, and says so',
    (categoryKey) => {
      expect(channels(null).channelsFor({ categoryKey })).toEqual(['email']);
      expect(warned[0]).toContain('floor');
    },
  );

  it('fails an optional category whose behaviour cannot be read, rather than sending on a guess', () => {
    expect(() => channels(null).channelsFor({ categoryKey: optional })).toThrow('sent on nothing');
  });

  // Task 50.1.1 lifted 49.3's refusal here: a raised notice has a store to land in-app in, so the channels stand.
  it.each([[['in_app']], [['in_app', 'email']]] as const)('answers a category travelling in-app (%j)', (list) => {
    expect(
      channels({ channels: list, classification: 'transactional' }).channelsFor({
        categoryKey: NOTIFICATION_CATEGORY.INVITATION,
      }),
    ).toEqual(list);
  });
});
