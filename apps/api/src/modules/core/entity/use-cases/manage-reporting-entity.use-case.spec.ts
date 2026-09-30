import { ManageReportingEntity } from './manage-reporting-entity.use-case';
import { CONSOLIDATION_BASIS, ENTITY_STATUS } from '../models/reporting-entity.model';
import {
  ConsolidationBoundaryEmptyError,
  EntityArchivedError,
  EntityNotFoundError,
  IdnoMalformedError,
  LegalFormUnknownError,
  LeiCheckDigitsError,
  LeiMalformedError,
  NaceCodeUnknownError,
} from '../errors/entity.errors';
import { FakeReportingEntityStore, anEntity } from '../testing/entity.fakes';
import {
  FakeOrganizationStore,
  FakeOrganizationVocabulary,
  anOrganization,
} from '@api/modules/core/organization/testing/organization.fakes';
import { FakeEntitySnapshotRefresh } from '@api/modules/core/period/testing/period.fakes';

/** UC-52, UC-53, UC-55 (FR-17, FR-18, FR-20). No database, no container. */
describe('ManageReportingEntity', () => {
  const at = new Date('2026-08-28T09:00:00.000Z');

  const build = (rows = [anEntity()]) => {
    const store = new FakeReportingEntityStore(rows);
    const snapshots = new FakeEntitySnapshotRefresh();
    const useCase = new ManageReportingEntity(
      store,
      new FakeOrganizationStore(),
      new FakeOrganizationVocabulary(),
      snapshots,
      () => at,
    );
    return { store, snapshots, useCase };
  };

  const NEW = {
    name: 'Cafeneaua Lina',
    legalForm: 'srl',
    idno: null,
    lei: null,
    naceCodes: [],
    sites: [],
    registeredAddressLine1: null,
    registeredAddressLine2: null,
    registeredLocality: null,
    registeredPostalCode: null,
    reportContactName: null,
    reportContactEmail: null,
    consolidationBasis: null,
    consolidationMembers: [],
  };

  describe('the record following into the periods (FR-27 as amended 30 Sep 2026, task 180.2)', () => {
    it('asks, once a save is written, for the entity it wrote at the moment it wrote it', async () => {
      const { store, snapshots, useCase } = build();

      await useCase.update({ entityId: store.all[0].id, patch: { name: 'Brutăria Lina SRL' } });

      expect(snapshots.calls).toEqual([{ reportingEntityId: store.all[0].id, at }]);
    });

    it('asks nothing when the save is refused, since nothing was written', async () => {
      const { store, snapshots, useCase } = build([anEntity({ status: ENTITY_STATUS.ARCHIVED })]);

      await expect(
        useCase.update({ entityId: store.all[0].id, patch: { name: 'Nou' } }),
      ).rejects.toBeInstanceOf(EntityArchivedError);
      expect(snapshots.calls).toEqual([]);
    });

    it('asks nothing on a creation, which has no period yet', async () => {
      const { snapshots, useCase } = build();

      await useCase.create({ entity: NEW });

      expect(snapshots.calls).toEqual([]);
    });
  });

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
        new FakeEntitySnapshotRefresh(),
        () => at,
      );

      await expect(
        useCase.create({ entity: { ...NEW, naceCodes: ['10.11'] } }),
      ).rejects.toBeInstanceOf(NaceCodeUnknownError);
    });
  });

  describe("FR-16's identifiers (task 175 moved them here from the organization)", () => {
    // A real, published LEI (Deutsche Bank AG), so the corpus cannot agree with a wrong
    // implementation the way an invented string would.
    const LEI = '7LTWFZYICNSX8D621K86';
    const IDNO = '1003600158022';

    it('records both, at creation and on an edit, when they are valid', async () => {
      const { store, useCase } = build();

      const created = await useCase.create({ entity: { ...NEW, idno: IDNO, lei: LEI } });
      expect([created.idno, created.lei]).toEqual([IDNO, LEI]);

      const edited = await useCase.update({ entityId: store.all[0].id, patch: { idno: IDNO } });
      expect(edited.idno).toBe(IDNO);
    });

    it('clears either on an explicit null, since neither is required here', async () => {
      const { store, useCase } = build([anEntity({ idno: IDNO, lei: LEI })]);

      // What makes the IDNO required is that a report cannot be filed without it (task 40), not
      // this record — so S-13 must be able to empty a field somebody filled in wrongly.
      const updated = await useCase.update({ entityId: store.all[0].id, patch: { idno: null, lei: null } });

      expect(updated.idno).toBeNull();
      expect(updated.lei).toBeNull();
    });

    it.each([
      ['twelve digits', '100360015802'],
      ['fourteen digits', '10036001580222'],
      ['a letter', '100360015802X'],
    ])('refuses an IDNO of %s, on creation and on an edit, writing nothing', async (_label, idno) => {
      const { store, useCase } = build();
      const before = store.all.length;

      await expect(useCase.create({ entity: { ...NEW, idno } })).rejects.toBeInstanceOf(IdnoMalformedError);
      expect(store.all).toHaveLength(before);
      await expect(useCase.update({ entityId: store.all[0].id, patch: { idno } })).rejects.toBeInstanceOf(
        IdnoMalformedError,
      );
      expect(store.all[0].idno).toBeNull();
    });

    it('refuses a malformed LEI distinctly from one whose check digits disagree', async () => {
      const { store, useCase } = build();
      const entityId = store.all[0].id;

      // Wrong shape: nineteen characters. The resolution is to retype it.
      await expect(useCase.update({ entityId, patch: { lei: LEI.slice(0, 19) } })).rejects.toBeInstanceOf(
        LeiMalformedError,
      );

      // Right shape, two adjacent characters transposed. Nothing about the value looks wrong, and
      // only the checksum sees it — which is the whole argument for running one. The resolution is
      // different too: go back to the register rather than retype.
      await expect(
        useCase.update({ entityId, patch: { lei: '7LTWFZYICNSX8D62K186' } }),
      ).rejects.toBeInstanceOf(LeiCheckDigitsError);
    });

    it('does not refuse an IDNO on its check digit, because that algorithm is unknown', async () => {
      const { useCase } = build();

      // Thirteen digits whose thirteenth is almost certainly not the right check digit — and it is
      // accepted, deliberately. §7.2 records why: the algorithm is not published in the defining
      // instrument, a candidate reproduced 2 of 12 real IDNOs, and a guessed one would refuse real
      // registrations rather than catch mistyped ones. This test is what makes that a decision
      // rather than an omission, and it is the one to change when the norm is found.
      const created = await useCase.create({ entity: { ...NEW, idno: '1003600158029' } });

      expect(created.idno).toBe('1003600158029');
    });
  });

  // Task 177: the organization is the account, so what a report prints is the entity's — its legal form, held to the
  // organization's country as the organization's was, and the address and the report contact that moved here.
  describe('what the report prints (task 177 moved it here from the organization)', () => {
    it('admits a legal form the organization’s country registers, and refuses one it does not', async () => {
      const { useCase } = build([]);

      await expect(useCase.create({ entity: { ...NEW, legalForm: 'sa' } })).resolves.toMatchObject({ legalForm: 'sa' });
      // `pfa` is a Romanian form, and the organization is Moldovan.
      await expect(useCase.create({ entity: { ...NEW, legalForm: 'pfa' } })).rejects.toBeInstanceOf(
        LegalFormUnknownError,
      );
    });

    it('refuses an unregistered legal form on an edit, and lets one be cleared', async () => {
      const { store, useCase } = build();

      await expect(
        useCase.update({ entityId: store.all[0].id, patch: { legalForm: 'pfa' } }),
      ).rejects.toBeInstanceOf(LegalFormUnknownError);
      expect(store.all[0].legalForm).toBe('srl');

      // An entity whose form is not decided yet is a state S-13 must be able to return to.
      const cleared = await useCase.update({ entityId: store.all[0].id, patch: { legalForm: null } });
      expect(cleared.legalForm).toBeNull();
    });

    it('records the registered address and the report contact on a new entity and on an edit', async () => {
      const { store, useCase } = build([]);

      const created = await useCase.create({
        entity: {
          ...NEW,
          registeredAddressLine1: 'str. Ștefan cel Mare 1',
          registeredLocality: 'Chișinău',
          reportContactName: 'Ana Rusu',
          reportContactEmail: 'ana@cafeneaua.md',
        },
      });
      expect(created).toMatchObject({
        registeredAddressLine1: 'str. Ștefan cel Mare 1',
        registeredLocality: 'Chișinău',
        reportContactName: 'Ana Rusu',
        reportContactEmail: 'ana@cafeneaua.md',
      });

      const edited = await useCase.update({
        entityId: store.all[0].id,
        patch: { registeredPostalCode: 'MD-2001', reportContactEmail: null },
      });
      expect(edited).toMatchObject({
        registeredLocality: 'Chișinău',
        registeredPostalCode: 'MD-2001',
        reportContactName: 'Ana Rusu',
        reportContactEmail: null,
      });
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

  describe('the reporting boundary (FR-19, UC-54)', () => {
    const SUBSIDIARY = { name: 'Lina Distribuție SRL', idno: null, lei: null, countryCode: 'MD' };

    it('records an individual basis with no subsidiaries', async () => {
      const { store, useCase } = build();

      const updated = await useCase.update({
        entityId: store.all[0].id,
        patch: { consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL },
      });

      expect(updated.consolidationBasis).toBe(CONSOLIDATION_BASIS.INDIVIDUAL);
    });

    it('records a consolidated basis with the subsidiaries inside it', async () => {
      const { store, useCase } = build();

      const updated = await useCase.update({
        entityId: store.all[0].id,
        patch: {
          consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
          consolidationMembers: [SUBSIDIARY],
        },
      });

      expect(updated.consolidationBasis).toBe(CONSOLIDATION_BASIS.CONSOLIDATED);
      expect(updated.consolidationMembers).toHaveLength(1);
    });

    it('refuses a consolidated basis with nothing inside the boundary', async () => {
      const { store, useCase } = build();

      // FR-19 reads "where consolidated, the subsidiaries inside the reporting boundary": a
      // consolidated basis names a boundary, and an empty boundary names nothing — while every
      // quantitative figure in the report is gathered against it.
      await expect(
        useCase.update({
          entityId: store.all[0].id,
          patch: { consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED },
        }),
      ).rejects.toBeInstanceOf(ConsolidationBoundaryEmptyError);
    });

    it('refuses emptying the boundary while the basis still says consolidated', async () => {
      const { store, useCase } = build();
      await useCase.update({
        entityId: store.all[0].id,
        patch: {
          consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
          consolidationMembers: [SUBSIDIARY],
        },
      });

      // The rule is checked against the state the patch *results in*, so it is reachable by
      // changing either half — not only by setting the basis.
      await expect(
        useCase.update({ entityId: store.all[0].id, patch: { consolidationMembers: [] } }),
      ).rejects.toBeInstanceOf(ConsolidationBoundaryEmptyError);
    });

    it('keeps the subsidiaries when the basis moves back to individual', async () => {
      const { store, useCase } = build();
      await useCase.update({
        entityId: store.all[0].id,
        patch: {
          consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED,
          consolidationMembers: [SUBSIDIARY],
        },
      });

      const updated = await useCase.update({
        entityId: store.all[0].id,
        patch: { consolidationBasis: CONSOLIDATION_BASIS.INDIVIDUAL },
      });

      // Nothing in UC-54 asks for a destructive switch, and B1 reads the basis first — so the list
      // is inert rather than gone, and switching back does not mean retyping the group.
      expect(updated.consolidationBasis).toBe(CONSOLIDATION_BASIS.INDIVIDUAL);
      expect(updated.consolidationMembers).toHaveLength(1);
    });

    // Task 176: the create path dropped the boundary, and with it the rule — so a new entity could be consolidated
    // over nothing, which the edit refuses.
    it('records a basis and its subsidiaries stated at creation', async () => {
      const { useCase } = build([]);

      const created = await useCase.create({
        entity: { ...NEW, consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED, consolidationMembers: [SUBSIDIARY] },
      });

      expect(created.consolidationBasis).toBe(CONSOLIDATION_BASIS.CONSOLIDATED);
      expect(created.consolidationMembers.map((member) => member.name)).toEqual(['Lina Distribuție SRL']);
    });

    it('refuses creating a consolidated entity with nothing inside the boundary, writing nothing', async () => {
      const { store, useCase } = build([]);

      await expect(
        useCase.create({ entity: { ...NEW, consolidationBasis: CONSOLIDATION_BASIS.CONSOLIDATED } }),
      ).rejects.toBeInstanceOf(ConsolidationBoundaryEmptyError);
      expect(store.all).toHaveLength(0);
    });

    it('records subsidiaries stated at creation whatever the basis, as the edit does', async () => {
      const { useCase } = build([]);

      // Unstated or individual, the list is inert rather than refused — the edit's rule, not a second one.
      const created = await useCase.create({ entity: { ...NEW, consolidationMembers: [SUBSIDIARY] } });

      expect(created.consolidationBasis).toBeNull();
      expect(created.consolidationMembers).toHaveLength(1);
    });
  });

  it('refuses an unknown entity id', async () => {
    const { useCase } = build();

    await expect(
      useCase.update({ entityId: '00000000-0000-0000-0000-00000000ffff', patch: {} }),
    ).rejects.toBeInstanceOf(EntityNotFoundError);
  });
});
