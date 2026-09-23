import { NOTIFICATION_CHANNEL, NOTIFICATION_CLASSIFICATION } from '../models/notification-category.model';
import { publicationConsequences } from './publication-consequences';

/** A-17's scope disclosure (task 67.10): what a publication changes for recipients. Literals: the wire values. */
describe('publicationConsequences (task 67.10)', () => {
  const { EMAIL, IN_APP } = NOTIFICATION_CHANNEL;
  const { OPTIONAL, TRANSACTIONAL } = NOTIFICATION_CLASSIFICATION;
  const switchOffs = { byChannel: { in_app: 2, email: 5 }, people: 6 };

  it('names nothing when nothing changes', () => {
    const behaviour = { channels: [IN_APP, EMAIL], classification: OPTIONAL };
    expect(publicationConsequences({ current: behaviour, proposed: behaviour, switchOffs })).toEqual([]);
  });

  it('names the people whose switch-offs stop counting when an optional category becomes transactional', () => {
    expect(
      publicationConsequences({
        current: { channels: [IN_APP, EMAIL], classification: OPTIONAL },
        proposed: { channels: [IN_APP, EMAIL], classification: TRANSACTIONAL },
        switchOffs,
      }),
    ).toEqual([{ kind: 'switch_offs_overridden', people: 6 }]);
  });

  it('says recipients may switch off a category made optional', () => {
    expect(
      publicationConsequences({
        current: { channels: [EMAIL], classification: TRANSACTIONAL },
        proposed: { channels: [EMAIL], classification: OPTIONAL },
        switchOffs,
      }),
    ).toEqual([{ kind: 'becomes_switchable' }]);
  });

  it('names a channel removed, and one added with the people who stay switched off there', () => {
    expect(
      publicationConsequences({
        current: { channels: [IN_APP], classification: OPTIONAL },
        proposed: { channels: [EMAIL], classification: OPTIONAL },
        switchOffs,
      }),
    ).toEqual([
      { kind: 'channel_removed', channel: 'in_app' },
      { kind: 'channel_added', channel: 'email', stayingOff: 5 },
    ]);
  });

  it('adds every channel of a category with nothing in force', () => {
    expect(
      publicationConsequences({
        current: null,
        proposed: { channels: [EMAIL], classification: TRANSACTIONAL },
        switchOffs,
      }),
    ).toEqual([{ kind: 'channel_added', channel: 'email', stayingOff: 0 }]);
  });
});
