import { Logger } from '@nestjs/common';
import { MANDATORY_NOTIFICATION_CATEGORIES, NOTIFICATION_CATEGORY } from '@api/contracts/notification.port';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { readSeedEntries, seedConfigurationStore } from '@api/testing/seed-configuration-store';
import { NOTIFICATION_CATEGORY_CONFIG_KIND } from '../constants/notification-category.constants';
import { NotificationCategoryCatalog } from './notification-category-catalog.service';

/**
 * The category catalogue, read from configuration and failing closed (task 49.1; §12.5.6's task-49.1 row).
 *
 * Two halves, on `SeatAllowanceService`'s spec's reasoning: what the reader does with a payload an operator
 * can publish by mistake, and whether the **shipped** catalogue reads at all — and says what the owner
 * decided it says.
 */
describe('NotificationCategoryCatalog (task 49.1)', () => {
  const build = (payload: unknown, revision = 1) => {
    const store = {
      get: (query: { kind: string; scope: string }) =>
        payload === undefined ||
        query.kind !== NOTIFICATION_CATEGORY_CONFIG_KIND ||
        query.scope !== NOTIFICATION_CATEGORY.INVITATION
          ? undefined
          : { kind: query.kind, scope: query.scope, revision, payload },
    } as unknown as ConfigurationStore;
    return new NotificationCategoryCatalog(store);
  };

  let logged: string[] = [];

  beforeEach(() => {
    // Captured rather than silenced: failing closed is only safe when the line saying so is written.
    logged = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((message: unknown) => {
      logged.push(String(message));
    });
  });

  afterEach(() => jest.restoreAllMocks());

  it('reads the behaviour in force for the category asked about, quietly', () => {
    const catalog = build({ channels: ['in_app', 'email'], classification: 'transactional' });

    expect(catalog.behaviourOf({ categoryKey: NOTIFICATION_CATEGORY.INVITATION })).toEqual({
      channels: ['in_app', 'email'],
      classification: 'transactional',
    });
    expect(logged).toEqual([]);
  });

  // A category outside the mandatory set — the manual reminder, the first optional one (task 50.3): the refusal below
  // is keyed on that set, and must not refuse an optional category's own classification.
  it('reads an optional category classified optional, quietly', () => {
    const optional = NOTIFICATION_CATEGORY.MANUAL_REMINDER;
    const store = {
      get: (query: { kind: string; scope: string }) =>
        query.scope === optional
          ? { kind: query.kind, scope: query.scope, revision: 1, payload: { channels: ['email'], classification: 'optional' } }
          : undefined,
    } as unknown as ConfigurationStore;

    expect(new NotificationCategoryCatalog(store).behaviourOf({ categoryKey: optional })).toEqual({
      channels: ['email'],
      classification: 'optional',
    });
    expect(logged).toEqual([]);
  });

  // **Code declares what nobody may turn off** (task 49.3): an artefact saying otherwise is refused, not obeyed.
  it('refuses a mandatory category classified optional, naming the revision to replace', () => {
    const catalog = build({ channels: ['email'], classification: 'optional' }, 5);

    expect(catalog.behaviourOf({ categoryKey: NOTIFICATION_CATEGORY.INVITATION })).toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('revision 5');
    expect(logged[0]).toContain('mandatory');
  });

  it('asks the store by the category key as the scope, and answers nothing for another', () => {
    const catalog = build({ channels: ['email'], classification: 'transactional' });

    expect(catalog.behaviourOf({ categoryKey: NOTIFICATION_CATEGORY.PASSWORD_RESET })).toBeNull();
    expect(logged[0]).toContain(`${NOTIFICATION_CATEGORY_CONFIG_KIND}/${NOTIFICATION_CATEGORY.PASSWORD_RESET}`);
  });

  it('fails closed on a malformed artefact, naming the revision to replace', () => {
    const catalog = build({ channels: [], classification: 'transactional' }, 3);

    expect(catalog.behaviourOf({ categoryKey: NOTIFICATION_CATEGORY.INVITATION })).toBeNull();
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('revision 3');
  });

  describe('the shipped catalogue', () => {
    const shipped = readSeedEntries().filter((entry) => entry.kind === NOTIFICATION_CATEGORY_CONFIG_KIND);

    /**
     * **The owner's decision, not a default this spec happens to know** (21 Sep 2026): the four notices sent to an
     * address, each by email alone and none of them a recipient's to turn off. Changing a seed without changing
     * §12.5.6's row fails here.
     */
    it.each([...MANDATORY_NOTIFICATION_CATEGORIES])('reads %s as email-only and transactional', (categoryKey) => {
      const catalog = new NotificationCategoryCatalog(seedConfigurationStore(readSeedEntries()));

      expect(catalog.behaviourOf({ categoryKey })).toEqual({
        channels: ['email'],
        classification: 'transactional',
      });
      expect(logged).toEqual([]);
    });

    // The manual reminder (§12.5.6's task-50.3 row (2)): optional, in-app alone until task 52.2.2's one-click
    // unsubscribe let an optional category send email, and by email too since.
    it('reads the manual reminder as optional, in-app and by email', () => {
      const catalog = new NotificationCategoryCatalog(seedConfigurationStore(readSeedEntries()));

      expect(catalog.behaviourOf({ categoryKey: NOTIFICATION_CATEGORY.MANUAL_REMINDER })).toEqual({
        channels: ['in_app', 'email'],
        classification: 'optional',
      });
      expect(logged).toEqual([]);
    });

    // **A category arrives with its producer** (§12.5.6's task-49.1 row (1)): an artefact whose scope no code
    // raises is a notice nothing sends, and S-27 would draw a preference over it.
    it('registers exactly the vocabulary — no category ahead of its producer, none without its artefact', () => {
      expect(shipped.map((entry) => entry.scope).sort()).toEqual(
        [...Object.values(NOTIFICATION_CATEGORY)].sort(),
      );
    });
  });
});
