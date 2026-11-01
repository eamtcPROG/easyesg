import { initialiseCatalogue } from '@api/app/messages/catalogue';
import { DisclosureLabelService } from '@api/modules/platform/localization/services/disclosure-label.service';
import { EntityFieldNamesService } from '@api/modules/platform/localization/services/entity-field-names.service';
import { NoticeParamsService } from './notice-params.service';

/**
 * An outstanding report's field list, as a reader is sent it (task 51.2; FR-164) — and since task 210 the entity's IDNO
 * named in it as S-08 names it, a field no taxonomy version labels (§12.5.6's task-210 row (e)).
 */
describe('NoticeParamsService', () => {
  beforeAll(() => initialiseCatalogue());

  const params = new NoticeParamsService(new DisclosureLabelService(), new EntityFieldNamesService());
  const outstanding = (elementKeys: string[]) => ({
    fields: { fieldList: { taxonomyVersion: '2026-05-01', modules: [{ module: 'B1', elementKeys }] } },
  });

  it('names the entity’s IDNO beside a disclosure’s label, rather than leaving it out', () => {
    expect(params.forLocale({ params: outstanding(['Turnover', 'entity:idno']), locale: 'ro' })).toEqual({
      fields: 'B1: Cifra de afaceri și IDNO',
    });
  });

  it('never asks the disclosure labels for an entity field, which would log it as a defect (task 219)', () => {
    const labels = new DisclosureLabelService();
    const asked = jest.spyOn(labels, 'label');
    const named = new NoticeParamsService(labels, new EntityFieldNamesService());
    expect(named.forLocale({ params: outstanding(['Turnover', 'entity:idno']), locale: 'ro' })).toEqual({
      fields: 'B1: Cifra de afaceri și IDNO',
    });
    expect(asked.mock.calls.map(([query]) => query.key)).toEqual(['Turnover']);
  });

  it('still leaves out a key nothing names — never printed as itself', () => {
    expect(params.forLocale({ params: outstanding(['entity:lei']), locale: 'en' })).toEqual({ fields: 'B1' });
  });
});
