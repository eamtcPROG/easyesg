import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { readLegalController } from '../domain/legal-controller';
import { LegalControllerUnavailableError } from '../errors/legal.errors';
import { LegalControllerService } from './legal-controller.service';

const SEEDED: unknown = JSON.parse(
  readFileSync(resolve(__dirname, '../../../../../../../config/seed/legal-controller.global.json'), 'utf8'),
);

/** The store's one method this service asks, answering what the case put in force. */
const storeHolding = (payload: unknown): ConfigurationStore =>
  ({
    get: () => (payload === undefined ? undefined : { kind: 'legal_controller', scope: 'global', revision: 4, payload }),
  }) as unknown as ConfigurationStore;

describe('LegalControllerService (FR-205; task 75)', () => {
  it('holds the shipped seed readable whole — the documents name it until A-21 replaces it', () => {
    expect(readLegalController(SEEDED)).not.toBeNull();
  });

  it('answers the controller in force', () => {
    expect(new LegalControllerService(storeHolding(SEEDED)).inForce()).toEqual(readLegalController(SEEDED));
  });

  it.each([
    ['nothing in force', undefined],
    ['a payload missing a field', { registeredName: 'EasyESG SRL' }],
  ])('refuses with %s, rather than naming half an operator', (_, payload) => {
    expect(() => new LegalControllerService(storeHolding(payload)).inForce()).toThrow(LegalControllerUnavailableError);
  });
});
