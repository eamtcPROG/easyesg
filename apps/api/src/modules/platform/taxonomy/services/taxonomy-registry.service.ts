import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import {
  DISCLOSURE_KIND,
  PERIOD_TYPE,
  type DisclosureKind,
  type PeriodType,
  type RegisteredTaxonomy,
  type TaxonomyAxis,
  type TaxonomyElement,
  type TaxonomyMember,
  type TaxonomyPin,
  type TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import {
  externalDomainConfigKind,
  REPORTING_TAXONOMY_CONFIG_KIND,
  TAXONOMY_STANDARD,
} from '../constants/taxonomy.constants';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'string');

const isDisclosureKind = (value: unknown): value is DisclosureKind =>
  Object.values(DISCLOSURE_KIND).some((kind) => kind === value);

const isPeriodType = (value: unknown): value is PeriodType =>
  Object.values(PERIOD_TYPE).some((type) => type === value);

/** One version's readable content, built once per configuration revision. */
interface ReadTaxonomy {
  readonly taxonomy: RegisteredTaxonomy;
  readonly elementsByKey: ReadonlyMap<string, TaxonomyElement>;
  readonly axesByKey: ReadonlyMap<string, TaxonomyAxis>;
}

/**
 * `TaxonomyRegistry` over the configuration store — the adapter half of AD-4 for FR-65 and FR-66.
 *
 * **Validated, never cast**, following `OrganizationVocabularyService`: a taxonomy version is data
 * an operator registers through A-04, so a malformed payload must surface as "that version is not
 * registered" plus an operator-facing log line. Cast instead, an element whose `kind` was misspelt
 * would reach a form as an undefined branch and render as free text — a wrong answer that looks
 * like a working one, on the one surface NFR-2 makes the schema's vocabulary.
 *
 * **A malformed element is dropped; a malformed version fails whole.** The split follows the same
 * reasoning as the NACE classifier's, in the opposite direction. There, one bad row must not remove
 * 995 good ones from a picker. Here a dropped element is a disclosure a report can never carry, so
 * dropping is only tolerable for the element itself — a version whose `elements` map is not a map
 * at all is unusable and answering with a partial taxonomy would let a report be authored against
 * one, then re-read against another.
 *
 * **Cached per configuration revision**, keyed on the revision so a publication invalidates it with
 * no invalidation logic — a new revision is a new key. The payload is 143 elements and eight axes,
 * one of which resolves 973 members from a second artefact, and the wizard asks about it per field.
 */
@Injectable()
export class TaxonomyRegistryService implements TaxonomyRegistry {
  private readonly logger = new Logger(TaxonomyRegistryService.name);

  private readonly cache = new Map<string, { revision: number; read: ReadTaxonomy }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  pinFor(query: { readonly on?: string }): TaxonomyPin | null {
    const entry = this.configurationStore.get({
      kind: REPORTING_TAXONOMY_CONFIG_KIND,
      // Scope is the standard, and there is one. Named rather than iterated because a second
      // standard would be a second pin with its own adoption date, not a list to choose from.
      scope: TAXONOMY_STANDARD.VSME,
      ...(query.on === undefined ? {} : { on: query.on }),
    });
    if (!entry) return null;

    const { standard, version, templateVersion } = entry.payload;
    if (
      typeof standard !== 'string' ||
      typeof version !== 'string' ||
      typeof templateVersion !== 'string'
    ) {
      this.logger.error(
        `Configuration entry ${REPORTING_TAXONOMY_CONFIG_KIND}/${TAXONOMY_STANDARD.VSME} ` +
          `(revision ${entry.revision}) is malformed; no report can be pinned to a version`,
      );
      return null;
    }
    return { standard, taxonomyVersion: version, templateVersion };
  }

  registeredVersions(query: { readonly standard: string }): readonly string[] {
    return this.configurationStore
      .list({ kind: configKindFor(query.standard) })
      .map((entry) => entry.scope)
      // Newest first, and a plain string sort is correct rather than lucky: OQ-45 made the
      // identifier EFRAG's own `YYYY-MM-DD`, and ISO 8601 dates order chronologically as text.
      .sort((a, b) => b.localeCompare(a));
  }

  taxonomy(query: {
    readonly standard: string;
    readonly version: string;
  }): RegisteredTaxonomy | null {
    return this.read(query)?.taxonomy ?? null;
  }

  element(query: {
    readonly standard: string;
    readonly version: string;
    readonly key: string;
  }): TaxonomyElement | null {
    return this.read(query)?.elementsByKey.get(query.key) ?? null;
  }

  axis(query: {
    readonly standard: string;
    readonly version: string;
    readonly key: string;
  }): TaxonomyAxis | null {
    return this.read(query)?.axesByKey.get(query.key) ?? null;
  }

  /** Reads and validates one version's payload once, for all three readers above. */
  private read(query: {
    readonly standard: string;
    readonly version: string;
  }): ReadTaxonomy | null {
    const kind = configKindFor(query.standard);
    const entry = this.configurationStore.get({ kind, scope: query.version });
    if (!entry) return null;

    const key = `${kind}/${query.version}`;
    const cached = this.cache.get(key);
    // `cached !== undefined` rather than `cached?.revision === entry.revision`: optional chaining
    // makes a cache *miss* compare `undefined === undefined`, which is true whenever the entry
    // carries no revision, and the hit path then reads a property off nothing.
    if (cached !== undefined && cached.revision === entry.revision) return cached.read;

    const { modules, elements, axes } = entry.payload;
    if (!isStringArray(modules) || !isRecord(elements) || !isRecord(axes)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${entry.revision}) is malformed; the version will ` +
          `read as unregistered`,
      );
      return null;
    }

    const readAxes = this.readAxes(axes, key, entry.revision);
    const readElements = this.readElements(elements, modules, key, entry.revision);

    const read: ReadTaxonomy = {
      taxonomy: {
        standard: query.standard,
        version: query.version,
        modules,
        elements: readElements,
      },
      elementsByKey: new Map(readElements.map((element) => [element.key, element])),
      axesByKey: new Map(readAxes.map((axis) => [axis.key, axis])),
    };
    this.cache.set(key, { revision: entry.revision, read });
    return read;
  }

  private readElements(
    elements: Record<string, unknown>,
    modules: readonly string[],
    key: string,
    revision: number,
  ): TaxonomyElement[] {
    const read: TaxonomyElement[] = [];
    const dropped: string[] = [];

    for (const [elementKey, value] of Object.entries(elements)) {
      if (!isRecord(value) || !isDisclosureKind(value.kind) || !isPeriodType(value.periodType)) {
        dropped.push(elementKey);
        continue;
      }
      read.push({
        key: elementKey,
        // `null` is the artefact's own answer for the standard's three pillar-level catch-alls, so
        // an absent module is read as that rather than as an unreadable row.
        module: typeof value.module === 'string' ? value.module : null,
        section: typeof value.section === 'string' ? value.section : '',
        order: typeof value.order === 'number' ? value.order : 0,
        parent: typeof value.parent === 'string' ? value.parent : null,
        kind: value.kind,
        xbrlType: typeof value.xbrlType === 'string' ? value.xbrlType : '',
        periodType: value.periodType,
        domain: typeof value.domain === 'string' ? value.domain : null,
        axes: isStringArray(value.axes) ? value.axes : [],
      });
    }

    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) has ${dropped.length} unreadable ` +
          `element(s), which no report will be able to carry: ${dropped.join(', ')}`,
      );
    }

    // The standard's own order: module as `modules` lists it, then presentation order within the
    // section. An unmoduled element sorts last rather than first, which is where the three
    // pillar-level catch-alls belong — `indexOf` answering -1 would put them ahead of B1.
    const moduleRank = (module: string | null): number =>
      module === null ? modules.length : modules.indexOf(module);
    return read.sort(
      (a, b) => moduleRank(a.module) - moduleRank(b.module) || a.order - b.order,
    );
  }

  private readAxes(
    axes: Record<string, unknown>,
    key: string,
    revision: number,
  ): TaxonomyAxis[] {
    const read: TaxonomyAxis[] = [];

    for (const [axisKey, value] of Object.entries(axes)) {
      if (!isRecord(value)) continue;
      const typed = value.typed === true;
      const local = isStringArray(value.members) ? value.members : [];

      // A domain published elsewhere is resolved here, so no caller learns that B7's members live
      // in a second artefact. An unresolvable reference leaves the axis with no members and says
      // so — the alternative is a waste picker that is silently empty.
      const external =
        typeof value.domainTaxonomy === 'string' && typeof value.domainVersion === 'string'
          ? this.readExternalDomain(value.domainTaxonomy, value.domainVersion, key, revision)
          : null;

      read.push({
        key: axisKey,
        typed,
        defaultMember: typeof value.defaultMember === 'string' ? value.defaultMember : null,
        members:
          external ??
          local.map((member) => ({ key: member, code: null, hazardous: null, labels: {} })),
      });
    }
    return read;
  }

  private readExternalDomain(
    domainTaxonomy: string,
    domainVersion: string,
    key: string,
    revision: number,
  ): TaxonomyMember[] | null {
    const domainKind = externalDomainConfigKind(domainTaxonomy);
    const entry = this.configurationStore.get({ kind: domainKind, scope: domainVersion });
    if (!entry || !isRecord(entry.payload.members)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) references ${domainKind}/` +
          `${domainVersion}, which is not registered or is malformed; the axis will offer no members`,
      );
      return null;
    }

    const members: (TaxonomyMember & { order: number })[] = [];
    for (const [memberKey, value] of Object.entries(entry.payload.members)) {
      if (!isRecord(value)) continue;
      members.push({
        key: memberKey,
        code: typeof value.code === 'string' ? value.code : null,
        // Absent means *the classification does not state it at this level* — a waste chapter —
        // which is a different answer from `false`, and B7 reports on `false`.
        hazardous: typeof value.hazardous === 'boolean' ? value.hazardous : null,
        labels: isRecord(value.labels)
          ? Object.fromEntries(
              Object.entries(value.labels).filter(
                (pair): pair is [string, string] => typeof pair[1] === 'string',
              ),
            )
          : {},
        order: typeof value.order === 'number' ? value.order : 0,
      });
    }

    return members
      .sort((a, b) => a.order - b.order)
      .map(({ order: _order, ...member }) => member);
  }
}

/**
 * A standard's registered-version kind, which is the standard's own name plus `_taxonomy` — the
 * shape `vsme_taxonomy` already has, so a second standard needs no case here.
 *
 * `taxonomy-registry.service.spec.ts` pins it against `VSME_TAXONOMY_CONFIG_KIND`, so the seed
 * file's name and this derivation cannot drift apart silently.
 */
const configKindFor = (standard: string): string => `${standard}_taxonomy`;
