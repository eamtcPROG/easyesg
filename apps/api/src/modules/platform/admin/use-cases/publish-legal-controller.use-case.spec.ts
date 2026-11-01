import { LEGAL_CONTROLLER_FAULT } from '@api/modules/platform/legal/domain/legal-controller';
import {
  LegalControllerChangedError,
  LegalControllerInvalidError,
  LegalControllerUnchangedError,
} from '../errors/legal-controller.errors';
import { FakeLegalControllerStore } from '../testing/legal-controller.fakes';
import { PublishLegalController } from './publish-legal-controller.use-case';

const CONTROLLER = {
  registeredName: 'EasyESG SRL',
  idno: '1099600012345',
  registeredAddress: 'str. Exemplului 1, MD-2001, mun. Chișinău',
  dataProtectionEmail: 'privacy@easyesg.md',
};

describe('PublishLegalController (FR-205; task 75)', () => {
  let store: FakeLegalControllerStore;
  let publish: PublishLegalController;

  beforeEach(() => {
    store = new FakeLegalControllerStore();
    store.stored = { controller: CONTROLLER, revision: 3, changedByEmail: null, changedAt: null };
    publish = new PublishLegalController(store);
  });

  it('publishes the four facts trimmed, against the revision the operator read', async () => {
    const publication = await publish.execute({
      ...CONTROLLER,
      registeredName: '  EasyESG Operator SRL ',
      revision: 3,
      operatorId: 'operator-1',
    });

    expect(publication).toEqual({ id: 'version-4', revision: 4 });
    expect(store.publications).toEqual([
      {
        controller: { ...CONTROLLER, registeredName: 'EasyESG Operator SRL' },
        expectedRevision: 3,
        operatorId: 'operator-1',
      },
    ]);
  });

  it('publishes the first controller into an empty slot', async () => {
    store = new FakeLegalControllerStore();
    publish = new PublishLegalController(store);

    await expect(publish.execute({ ...CONTROLLER, revision: 0, operatorId: 'operator-1' })).resolves.toEqual({
      id: 'version-1',
      revision: 1,
    });
  });

  it('refuses a field the documents could not state, naming the fault, and publishes nothing', async () => {
    const refusal = publish.execute({ ...CONTROLLER, idno: '1099600012346', revision: 3, operatorId: 'operator-1' });

    await expect(refusal).rejects.toBeInstanceOf(LegalControllerInvalidError);
    await expect(refusal).rejects.toMatchObject({ extensions: { fault: LEGAL_CONTROLLER_FAULT.IDNO_CHECK_DIGIT } });
    expect(store.publications).toEqual([]);
  });

  it('refuses a save identical to what is in force once trimmed, so the log records no change that did not happen', async () => {
    await expect(
      publish.execute({ ...CONTROLLER, idno: ` ${CONTROLLER.idno} `, revision: 3, operatorId: 'operator-1' }),
    ).rejects.toBeInstanceOf(LegalControllerUnchangedError);
    expect(store.publications).toEqual([]);
  });

  it('refuses a save made against a revision a colleague has since replaced', async () => {
    await expect(
      publish.execute({ ...CONTROLLER, registeredName: 'Other SRL', revision: 2, operatorId: 'operator-1' }),
    ).rejects.toBeInstanceOf(LegalControllerChangedError);
    expect(store.stored.controller).toEqual(CONTROLLER);
  });
});
