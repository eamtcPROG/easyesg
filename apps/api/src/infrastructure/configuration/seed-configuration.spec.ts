import { parseSeedName } from './seed-configuration';

/**
 * How a seed file names its artefact (task 49.1 widened the scope). Literals on purpose: these are file
 * names on disk and the rows they become.
 */
describe('parseSeedName', () => {
  it('folds the kind to underscores and takes the scope as written', () => {
    expect(parseSeedName('organization-legal-form.md.json')).toEqual({
      kind: 'organization_legal_form',
      scope: 'md',
    });
    expect(parseSeedName('vsme-taxonomy.2026-05-01.json')).toEqual({
      kind: 'vsme_taxonomy',
      scope: '2026-05-01',
    });
  });

  // A notification category is scoped by its key, which is its wording's catalogue path (FR-173).
  it('keeps the dots and underscores of a scope that is a category key', () => {
    expect(parseSeedName('notification-category.identity.password_reset.json')).toEqual({
      kind: 'notification_category',
      scope: 'identity.password_reset',
    });
  });

  it.each([
    ['a file with no scope', 'seat-allowance.json'],
    ['a kind with an underscore, which only the scope may carry', 'seat_allowance.global.json'],
    ['an uppercase name', 'Seat-allowance.global.json'],
    ['a file that is not JSON', 'README.md'],
  ])('names no artefact for %s', (_label, fileName) => {
    expect(parseSeedName(fileName)).toBeNull();
  });
});
