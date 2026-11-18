import type { ContentPublicationPreview } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { INITIAL_PUBLISH_STATE, PUBLISH_EVENT, publishReducer, readyToPublish } from './publish-state';

const PREVIEW: ContentPublicationPreview = {
  items: [{ kind: 'help_topic', key: 'a', publishable: true, locales: ['ro', 'en'], replaces: false }],
  locales: ['ro', 'en'],
  reach: { organizations: 3, reports: 0 },
};

describe('A-03’s publication dialogue (task 67.5; UX-123)', () => {
  const previewed = publishReducer(
    publishReducer(INITIAL_PUBLISH_STATE, { type: PUBLISH_EVENT.CHOSEN, chosen: [{ kind: 'help_topic', key: 'a' }] }),
    { type: PUBLISH_EVENT.PREVIEWED, preview: PREVIEW },
  );

  it('is ready only once every locale the set carries is signed off', () => {
    expect(readyToPublish(previewed)).toBe(false);
    const signed = publishReducer(previewed, { type: PUBLISH_EVENT.SIGNED, signedOff: ['ro', 'en'] });
    expect(readyToPublish(signed)).toBe(true);
  });

  it('voids the preview and the sign-off when the choice changes, so neither stands beside a set it was not given for', () => {
    const signed = publishReducer(previewed, { type: PUBLISH_EVENT.SIGNED, signedOff: ['ro', 'en'] });
    expect(publishReducer(signed, { type: PUBLISH_EVENT.CHOSEN, chosen: [] })).toEqual(INITIAL_PUBLISH_STATE);
  });

  it('is not ready while an item would not be read whole', () => {
    const notReady = publishReducer(
      publishReducer(INITIAL_PUBLISH_STATE, {
        type: PUBLISH_EVENT.PREVIEWED,
        preview: { ...PREVIEW, items: [{ ...PREVIEW.items[0], publishable: false }] },
      }),
      { type: PUBLISH_EVENT.SIGNED, signedOff: ['ro', 'en'] },
    );
    expect(readyToPublish(notReady)).toBe(false);
  });
});
