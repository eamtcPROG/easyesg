import { FakeLegalControllerStore, NO_LEGAL_CONTROLLER } from '../testing/legal-controller.fakes';
import { ReadLegalController } from './read-legal-controller.use-case';

describe('ReadLegalController (FR-205; task 75)', () => {
  it('answers an empty record at revision 0 where nothing was ever published, so the first can be', async () => {
    await expect(new ReadLegalController(new FakeLegalControllerStore()).execute()).resolves.toEqual(
      NO_LEGAL_CONTROLLER,
    );
  });
});
