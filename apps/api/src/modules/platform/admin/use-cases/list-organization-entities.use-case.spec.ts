import { OrganizationNotRegisteredError } from '../errors/organization-register.errors';
import type {
  OrganizationEntitiesRead,
  OrganizationEntitiesStore,
} from '../interfaces/organization-entities-store.interface';
import type { OrganizationEntity } from '../models/organization-entity.model';
import { ListOrganizationEntities } from './list-organization-entities.use-case';

const ORGANIZATION = '0b8a1f3e-0000-4000-8000-000000000001';
const OPERATOR = '0b8a1f3e-0000-4000-8000-0000000000aa';

const ENTITY: OrganizationEntity = {
  id: '0b8a1f3e-0000-4000-8000-0000000000e1',
  name: 'Lina SRL',
  idno: '1009600041284',
  status: 'active',
};

/** A store answering what the case gives it, and recording what it was asked — the requester above all. */
class FakeEntitiesStore implements OrganizationEntitiesStore {
  readonly asked: OrganizationEntitiesRead[] = [];
  constructor(private readonly answer: readonly OrganizationEntity[] | null) {}

  entities(read: OrganizationEntitiesRead) {
    this.asked.push(read);
    return Promise.resolve(this.answer);
  }
}

/** Task 175: A-02's record's entities, each with its IDNO. */
describe('ListOrganizationEntities', () => {
  it('answers the organization’s entities, asking as the operator reading', async () => {
    const store = new FakeEntitiesStore([ENTITY]);
    await expect(
      new ListOrganizationEntities(store).execute({ organizationId: ORGANIZATION, requesterId: OPERATOR }),
    ).resolves.toEqual([ENTITY]);
    expect(store.asked).toEqual([{ organizationId: ORGANIZATION, requesterId: OPERATOR }]);
  });

  it('answers an organization with no entity with none', async () => {
    await expect(
      new ListOrganizationEntities(new FakeEntitiesStore([])).execute({
        organizationId: ORGANIZATION,
        requesterId: OPERATOR,
      }),
    ).resolves.toEqual([]);
  });

  it('refuses an organization the register does not hold', async () => {
    await expect(
      new ListOrganizationEntities(new FakeEntitiesStore(null)).execute({
        organizationId: ORGANIZATION,
        requesterId: OPERATOR,
      }),
    ).rejects.toBeInstanceOf(OrganizationNotRegisteredError);
  });
});
