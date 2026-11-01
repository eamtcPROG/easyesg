import type { NotificationPreferences } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { centreCategories } from './centre-categories';

/** S-26's category choices (task 37.3): what travels in-app, named, and only once there are two to choose between. */
describe('the centre’s categories', () => {
  type Category = NotificationPreferences['categories'][number];
  const category = (over: Partial<Category> & Pick<Category, 'categoryKey'>): Category => ({
    categoryName: over.categoryKey,
    mandatory: false,
    channels: [
      { channel: 'in_app', enabled: true },
      { channel: 'email', enabled: true },
    ],
    ...over,
  });
  const reminder = category({ categoryKey: 'reporting.manual_reminder', categoryName: 'Mementouri' });
  const update = category({ categoryKey: 'reporting.report_update', categoryName: 'Actualizări ale rapoartelor' });
  const verification = category({
    categoryKey: 'identity.email_verification',
    categoryName: 'Confirmarea adresei',
    mandatory: true,
    channels: [{ channel: 'email', enabled: true }],
  });

  it('offers the categories that travel in-app, in the read’s order, by their names', () => {
    expect(centreCategories({ categories: [verification, reminder, update] })).toEqual([
      { key: 'reporting.manual_reminder', name: 'Mementouri' },
      { key: 'reporting.report_update', name: 'Actualizări ale rapoartelor' },
    ]);
  });

  /** A switch-off stops what arrives next, never what already arrived — the centre still holds those notices. */
  it('offers a category the person switched off in-app', () => {
    const switchedOff = { ...update, channels: [{ channel: 'in_app' as const, enabled: false }] };
    expect(centreCategories({ categories: [reminder, switchedOff] })).toHaveLength(2);
  });

  it('offers nothing while fewer than two named categories travel in-app', () => {
    expect(centreCategories({ categories: [verification, reminder] })).toEqual([]);
    expect(centreCategories({ categories: [reminder, { ...update, categoryName: undefined }] })).toEqual([]);
  });
});
