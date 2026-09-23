import { LOCALES } from '@easyesg/i18n';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { NOTIFICATION_CHANNEL } from '../models/notification-category.model';
import { NotificationCategoryCatalog } from './notification-category-catalog.service';
import { CategoryWordingService } from './category-wording.service';

/**
 * A-17's wording, rendered with each category's specimen (task 67.10; §12.5.6's task-67.10 row (1)).
 *
 * **Every placeholder a category's wording uses is in its specimen**, in every locale: `translate` answers nothing for a
 * placeholder it was not given, so a specimen missing one would show the operator a channel with no words — and
 * `worded` would refuse to publish a channel that the send can in fact word. The shipped behaviour is the reference:
 * whatever a category's seed publishes must render.
 */
/** Every string the operator would read, however deep. */
const texts = (value: unknown): string[] =>
  typeof value === 'string' ? [value] : typeof value === 'object' && value !== null ? Object.values(value).flatMap(texts) : [];

describe('CategoryWordingService (task 67.10)', () => {
  const wording = new CategoryWordingService();
  const catalog = new NotificationCategoryCatalog(seedConfigurationStore(readSeedEntries()));

  beforeAll(initialiseCatalogue);

  it.each(Object.values(NOTIFICATION_CATEGORY))('renders %s’s published channels in every locale', (categoryKey) => {
    const channels = catalog.behaviourOf({ categoryKey })?.channels ?? [];
    expect(channels.length).toBeGreaterThan(0);

    for (const locale of LOCALES) {
      const rendered = wording.render({ categoryKey, locale });
      if (channels.includes(NOTIFICATION_CHANNEL.EMAIL)) expect(rendered.email).toBeDefined();
      if (channels.includes(NOTIFICATION_CHANNEL.IN_APP)) expect(rendered.inApp).toBeDefined();
      expect(texts(rendered).filter((text) => /[{}]/u.test(text))).toEqual([]);
    }
    for (const channel of channels) expect(wording.worded({ categoryKey, channel })).toBe(true);
  });

  // The manual reminder is worded for both channels; an address notice is worded for email alone, so its in-app is not.
  it('says a channel is unworded where the catalogue holds no words for it', () => {
    expect(wording.worded({ categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET, channel: NOTIFICATION_CHANNEL.IN_APP })).toBe(false);
    expect(wording.worded({ categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER, channel: NOTIFICATION_CHANNEL.IN_APP })).toBe(true);
  });
});
