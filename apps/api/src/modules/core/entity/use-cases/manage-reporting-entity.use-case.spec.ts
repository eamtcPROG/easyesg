import { ManageReportingEntity } from './manage-reporting-entity.use-case';
import { ENTITY_STATUS } from '../models/reporting-entity.model';
import {
  EntityArchivedError,
  EntityNotFoundError,
  NaceCodeUnknownError,
} from '../errors/entity.errors';
import { FakeReportingEntityStore, anEntity } from '../testing/entity.fakes';
import {
  FakeOrganizationStore,
  FakeOrganizationVocabulary,
  anOrganization,
} from '@api/modules/core/organization/testing/organization.fakes';

/** UC-52, UC-53, UC-55 (FR-17, FR-18, FR-20). No database, no container. */
describe('ManageReportingEntity', () => {
  const at = new Date('2026-08-28T09:00:00.000Z');

  const build = (rows = [anEntity()]) => {
    const store = new FakeReportingEntityStore(rows);
    const useCase = new ManageReportingEntity(
      store,
      new FakeOrganizationStore(),
      new FakeOrganizationVocabulary(),
      () => at,
    );
    return { store, useCase };
  };

  const NEW = { name: 'Cafeneaua Lina', legalForm: 'srl', naceCodes: [], sites: [] };

  describe('activity codes (FR-17)', () => {
    it('admits codes the country’s classifier registers', async () => {
      const { useCase } = build();

      const created = await useCase.create({ entity: { ...NEW, naceCodes: ['10.11', '62.01'] } });

      expect(created.naceCodes).toEqual(['10.11', '62.01']);
    });

    it('refuses a code the classifier does not register, writing nothing', async () => {
      const { store, useCase } = build();
      const before = store.all.length;

      // Well-formed as a NACE code and absent from CAEM — which is exactly the case a shape check
      // cannot catch and the classifier can.
      await expect(
        useCase.create({ entity: { ...NEW, naceCodes: ['10.11', '99.99'] } }),
      ).rejects.toBeInstanceOf(NaceCodeUnknownError);
      expect(store.all).toHaveLength(before);
    });

    it('permits no codes at all, because FR-17 does not require one', async () => {
      const { useCase } = build();

      // An entity may be created before anybody has classified it; the vocabulary is not consulted.
      expect((await useCase.create({ entity: NEW })).naceCodes).toEqual([]);
    });

    it('refuses when the country registers no classifier', async () => {
      const store = new FakeReportingEntityStore([anEntity()]);
      const useCase = new ManageReportingEntity(
        store,
        new FakeOrganizationStore(anOrganization({ countryCode: 'FR' })),
        new FakeOrganizationVocabulary(),
        () => at,
      );

      await expect(
        useCase.create({ entity: { ...NEW, naceCodes: ['10.11'] } }),
      ).rejects.toBeInstanceOf(NaceCodeUnknownError);
    });
  });

  describe('archiving (FR-20, UC-55)', () => {
    it('archives an active entity and stamps when', async () => {
      const { store, useCase } = build();

      await useCase.archive({ entityId: store.all[0].id });

      expect(store.all[0].status).toBe(ENTITY_STATUS.ARCHIVED);
      expect(store.all[0].archivedAt).toEqual(at);
    });

    it('refuses to archive one that already is, rather than passing silently', async () => {
      const { store, useCase } = build([anEntity({ status: ENTITY_STATUS.ARCHIVED, archivedAt: at })]);

      // UC-55 has no un-archive, so repeating it is never a deliberate step — reporting it is more
      // useful than absorbing it.
      await expect(useCase.archive({ entityId: store.all[0].id })).rejects.toBeInstanceOf(
        EntityArchivedError,
      );
    });

    it('refuses to edit an archived entity, which stays readable', async () => {
      const { store, useCase } = build([anEntity({ status: ENTITY_STATUS.ARCHIVED, archivedAt: at })]);

      // FR-20 keeps its reports and exports retrievable, so the refusal is about state (409) and
      // not about existence (404) — a distinction S-13 needs to render a read-only record.
      await expect(
        useCase.update({ entityId: store.all[0].id, patch: { name: 'Renamed' } }),
      ).rejects.toBeInstanceOf(EntityArchivedError);
      expect(store.all[0].name).toBe('Brutăria Lina');
    });
  });

  it('refuses an unknown entity id', async () => {
    const { useCase } = build();

    await expect(
      useCase.update({ entityId: '00000000-0000-0000-0000-00000000ffff', patch: {} }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
