import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { LocaleOfferService } from './locale-offer.service';

const storeHolding = (payload: unknown) =>
  ({ get: () => (payload === undefined ? undefined : { payload }) }) as unknown as ConfigurationStore;

describe('LocaleOfferService (task 67.16; FR-63 AC-6)', () => {
  it('offers the built locales the registration names', () => {
    const offer = new LocaleOfferService(
      storeHolding({ locales: [{ code: 'ro', source: true }, { code: 'ru', source: false }, { code: 'de', source: false }] }),
    );
    expect(offer.offered()).toEqual(['ro', 'ru']);
  });

  it('offers the source locale alone where no readable registration is in force', () => {
    expect(new LocaleOfferService(storeHolding(undefined)).offered()).toEqual(['ro']);
    expect(new LocaleOfferService(storeHolding({ locales: [{ code: 'en', source: true }] })).offered()).toEqual(['ro']);
  });
});
