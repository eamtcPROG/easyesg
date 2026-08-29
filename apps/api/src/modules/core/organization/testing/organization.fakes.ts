import type { OrganizationFoundingStore } from '../interfaces/organization-founding-store.interface';
import type { OrganizationStore } from '../interfaces/organization-store.interface';
import type { NaceCode, OrganizationVocabulary } from '../interfaces/organization-vocabulary.interface';
import type {
  NewOrganization,
  Organization,
  OrganizationProfilePatch,
} from '../models/organization.model';

/**
 * In-memory doubles for the organization use-case specs — no database, no container (CLAUDE.md's
 * check that the dependencies point inward).
 *
 * **`FakeOrganizationStore` models one organization, because RLS does.** The real store takes no
 * organization id anywhere: its policy is `id = app.current_org`, so the bound row is the only one
 * reachable. A fake holding several and selecting between them would model a filter production code
 * does not have, and a spec passing against it would prove something untrue. Cross-tenant behaviour
 * is asserted where it is actually enforced, in `tenant-isolation.e2e-spec.ts`.
 *
 * **It writes rather than recording calls**, so a spec can assert the thing that matters about a
 * patch — that an absent field survives and an explicit `null` clears — instead of asserting which
 * arguments a mock was handed.
 */

export const anOrganization = (overrides: Partial<Organization> = {}): Organization => ({
  id: '00000000-0000-0000-0000-0000000000a1',
  name: 'Fabrica de Cașcaval',
  countryCode: 'MD',
  legalForm: null,
  idno: null,
  lei: null,
  registeredAddressLine1: null,
  registeredAddressLine2: null,
  registeredLocality: null,
  registeredPostalCode: null,
  contactEmail: null,
  contactPhone: null,
  reportContactName: null,
  reportContactEmail: null,
  lastChange: null,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  ...overrides,
});

export class FakeOrganizationStore implements OrganizationStore {
  constructor(private row: Organization | null = anOrganization()) {}

  get current(): Organization | null {
    return this.row;
  }

  findBoundOrganization(): Promise<Organization | null> {
    return Promise.resolve(this.row);
  }

  updateProfile(patch: OrganizationProfilePatch, at: Date): Promise<Organization | null> {
    if (!this.row) return Promise.resolve(null);
    // Spread, so a key absent from the patch is untouched and a key holding `null` overwrites —
    // which is exactly the distinction the real `UPDATE` builds its assignment list from.
    this.row = { ...this.row, ...patch, updatedAt: at };
    return Promise.resolve(this.row);
  }
}

export class FakeOrganizationFoundingStore implements OrganizationFoundingStore {
  readonly founded: {
    organization: NewOrganization;
    founderAccountId: string;
    sessionId: string;
  }[] = [];

  createWithFoundingAdministrator(input: {
    organization: NewOrganization;
    founderAccountId: string;
    sessionId: string;
  }): Promise<Organization> {
    this.founded.push(input);
    return Promise.resolve(
      anOrganization({
        id: `00000000-0000-0000-0000-00000000${String(this.founded.length).padStart(4, '0')}`,
        name: input.organization.name,
        countryCode: input.organization.countryCode,
        contactEmail: input.organization.contactEmail,
        contactPhone: input.organization.contactPhone,
      }),
    );
  }
}

/**
 * The two configuration vocabularies, as plain maps.
 *
 * **Constructed with a map rather than a list**, because the port's contract is that a country
 * absent from configuration and a country registering an empty list are different answers — and a
 * fake taking `string[]` could not express the first without inventing a sentinel.
 */
export class FakeOrganizationVocabulary implements OrganizationVocabulary {
  constructor(
    private readonly legalForms: Record<string, readonly string[]> = { md: ['srl', 'sa', 'ii'] },
    private readonly types: readonly string[] = ['direct_sme'],
    /** A handful of real CAEM codes, enough to tell membership from its absence. */
    private readonly naceCodes: Record<string, readonly string[]> = {
      md: ['A', '01', '01.1', '01.11', '10.11', '62.01'],
    },
  ) {}

  legalFormsFor(countryCode: string): readonly string[] | null {
    return this.legalForms[countryCode.toLowerCase()] ?? null;
  }

  registeredLegalForms(): readonly { countryCode: string; legalForms: readonly string[] }[] {
    return Object.keys(this.legalForms)
      .sort()
      .map((countryCode) => ({ countryCode, legalForms: this.legalForms[countryCode] }));
  }

  naceCodesFor(countryCode: string): ReadonlySet<string> | null {
    const codes = this.naceCodes[countryCode.toLowerCase()];
    return codes ? new Set(codes) : null;
  }

  /**
   * Labels are synthesised from the code, which is deliberate: a spec asserting *which* label came
   * back would be asserting the fixture, and the rule worth pinning is the locale FALLBACK — so the
   * fake carries `ro` always and `en` only for codes that ask for it, letting a spec exercise the
   * missing-locale path without a 996-entry payload.
   */
  naceClassifierFor(countryCode: string): readonly NaceCode[] | null {
    const codes = this.naceCodes[countryCode.toLowerCase()];
    if (!codes) return null;
    return codes.map((code) => ({ code, labels: { ro: `${code} activitate`, en: `${code} activity` } }));
  }

  relationshipTypes(): readonly string[] {
    return this.types;
  }
}
