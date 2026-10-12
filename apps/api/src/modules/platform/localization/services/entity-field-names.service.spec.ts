import { LOCALES } from '@easyesg/i18n';
import { ENTITY_FIELD } from '@easyesg/validation';
import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { EntityFieldNamesService } from './entity-field-names.service';

/**
 * Task 210 (§12.5.6's task-210 row (e)): a finding on a field the entity's record answers is named, beside its message,
 * as S-13 names the field — in every locale, since a name some locale lacks would leave S-08's row, S-11's warning and
 * a notice's field list with no field to name.
 */
describe('EntityFieldNamesService', () => {
  beforeAll(() => initialiseCatalogue());

  it.each(LOCALES)('names every field the entity’s record answers in %s', (locale) => {
    const names = new EntityFieldNamesService().namesIn({ locale });
    expect(Object.keys(names).sort()).toEqual(Object.values(ENTITY_FIELD).sort());
    for (const name of Object.values(names)) expect(name.trim()).not.toBe('');
  });

  it('names the IDNO as S-13 labels it', () => {
    expect(new EntityFieldNamesService().namesIn({ locale: 'ro' })).toEqual({ 'entity:idno': 'IDNO' });
  });
});
