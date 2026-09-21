import { stillOwed } from './still-owed';

/** Which recipients a notice still owes, per channel (task 50.1.1). Literals on purpose: they are the stored values. */
describe('stillOwed (task 50.1.1)', () => {
  const ana = { userId: 'ana' };
  const ivan = { userId: 'ivan' };

  it('owes everyone named when nothing is recorded', () => {
    expect(stillOwed({ recipients: [ana, ivan], channel: 'email', delivered: [] })).toEqual([ana, ivan]);
  });

  it('owes nobody a delivery already recorded on that channel', () => {
    expect(
      stillOwed({ recipients: [ana, ivan], channel: 'email', delivered: [{ recipientId: 'ana', channel: 'email' }] }),
    ).toEqual([ivan]);
  });

  // A recipient reached in-app has not been emailed: the two are separate deliveries of one notice.
  it('does not count a delivery on another channel', () => {
    expect(
      stillOwed({ recipients: [ana], channel: 'email', delivered: [{ recipientId: 'ana', channel: 'in_app' }] }),
    ).toEqual([ana]);
  });

  it('ignores a recorded delivery to someone this raise does not name', () => {
    expect(
      stillOwed({ recipients: [ivan], channel: 'in_app', delivered: [{ recipientId: 'ana', channel: 'in_app' }] }),
    ).toEqual([ivan]);
  });
});
