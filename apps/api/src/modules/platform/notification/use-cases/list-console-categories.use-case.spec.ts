import { NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import { FakeCategoryConsoleStore } from '@api/testing/fake-category-console-store';
import { ListConsoleCategories } from './list-console-categories.use-case';

/** UC-176's read (task 67.10). Literals: the wire values the console draws. */
describe('ListConsoleCategories (task 67.10)', () => {
  const { MANUAL_REMINDER, INVITATION } = NOTIFICATION_CATEGORY;

  it('lists every category in the vocabulary’s order, including one with nothing in force', async () => {
    const categories = await new ListConsoleCategories(new FakeCategoryConsoleStore()).execute();

    expect(categories.map((category) => category.categoryKey)).toEqual(Object.values(NOTIFICATION_CATEGORY));
    expect(categories.every((category) => category.inForce === null)).toBe(true);
  });

  it('says what code declares — mandatory, and sent to an address — beside what is in force', async () => {
    const store = new FakeCategoryConsoleStore().seed(INVITATION, { channels: ['email'], classification: 'transactional' });
    const [invitation] = (await new ListConsoleCategories(store).execute()).filter((c) => c.categoryKey === INVITATION);

    expect(invitation).toMatchObject({
      mandatory: true,
      addressNotice: true,
      inForce: {
        behaviour: { channels: ['email'], classification: 'transactional' },
        revision: 1,
        previousRevision: null,
        previousBehaviour: null,
      },
    });
  });

  it('names the revision before the one in force, and counts the switch-offs', async () => {
    const store = new FakeCategoryConsoleStore().seed(
      MANUAL_REMINDER,
      { channels: ['in_app'], classification: 'optional' },
      { channels: ['in_app', 'email'], classification: 'optional' },
    );
    store.counts.set(MANUAL_REMINDER, { byChannel: { email: 3 }, people: 3 });
    const [reminder] = (await new ListConsoleCategories(store).execute()).filter((c) => c.categoryKey === MANUAL_REMINDER);

    expect(reminder).toMatchObject({
      mandatory: false,
      addressNotice: false,
      inForce: { revision: 2, previousRevision: 1, previousBehaviour: { channels: ['in_app'], classification: 'optional' } },
      switchOffs: { byChannel: { in_app: 0, email: 3 }, people: 3 },
    });
  });

  // Fail-closed shown as it is: the catalogue refuses this payload, so the console must not draw it as a behaviour.
  it('shows an unreadable payload as no behaviour, with its revision still named', async () => {
    const store = new FakeCategoryConsoleStore().seed(MANUAL_REMINDER, { channels: [], classification: 'optional' });
    const [reminder] = (await new ListConsoleCategories(store).execute()).filter((c) => c.categoryKey === MANUAL_REMINDER);

    expect(reminder.inForce).toMatchObject({ behaviour: null, revision: 1 });
  });
});
