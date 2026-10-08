import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_OMISSION_SECTION_CONFIG_KIND } from '../constants/disclosure.constants';
import type { OmissionSections } from '../interfaces/omission-sections.interface';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isElementList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === 'string' && entry !== '');

/**
 * `OmissionSections` over the configuration store (task 41.2; FR-31 AC-3).
 *
 * **Validated, never cast**, and **a malformed entry is dropped alone**, logged at `error` with its revision: the
 * section it described withholds nothing, so its elements stay in the run's scope. That is the direction a reporter
 * can see — a finding on a section they withheld, which they can question — where the opposite, a section withholding
 * elements it was never meant to, would hide `MISSING VALUE` behind a declaration and read ready to file.
 *
 * **Cached per configuration revision**, `ApplicabilityRulesService`'s rule: a publication is a new revision and a new
 * reading, with no invalidation.
 */
@Injectable()
export class OmissionSectionsService implements OmissionSections {
  private readonly logger = new Logger(OmissionSectionsService.name);

  private readonly cache = new Map<string, { revision: number; sections: ReadonlyMap<string, readonly string[]> }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  sectionsFor(query: { readonly standard: string }): ReadonlyMap<string, readonly string[]> {
    const entry = this.configurationStore.get({ kind: DISCLOSURE_OMISSION_SECTION_CONFIG_KIND, scope: query.standard });
    if (!entry) return new Map();
    const cached = this.cache.get(query.standard);
    if (cached !== undefined && cached.revision === entry.revision) return cached.sections;

    const sections = this.read(entry.payload.sections, query.standard, entry.revision);
    this.cache.set(query.standard, { revision: entry.revision, sections });
    return sections;
  }

  private read(raw: unknown, standard: string, revision: number): ReadonlyMap<string, readonly string[]> {
    const where = `${DISCLOSURE_OMISSION_SECTION_CONFIG_KIND}/${standard} (revision ${revision})`;
    if (!isRecord(raw)) {
      this.logger.error(`Configuration entry ${where} is malformed; no omitted section withholds anything`);
      return new Map();
    }
    const sections = new Map<string, readonly string[]>();
    const dropped: string[] = [];
    for (const [member, elements] of Object.entries(raw)) {
      if (isElementList(elements)) sections.set(member, [...elements]);
      else dropped.push(member);
    }
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${where} carries malformed section(s), which withhold nothing: ${dropped.join(', ')}`,
      );
    }
    return sections;
  }
}
