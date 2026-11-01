import { Injectable, Logger } from '@nestjs/common';
import { ConfigurationStore } from '@api/infrastructure/configuration/configuration-store.service';
import { DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND } from '../constants/disclosure.constants';
import type { OfferedMembers } from '../interfaces/offered-members.interface';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const NONE: ReadonlyMap<string, ReadonlySet<string>> = new Map();

/**
 * Which members an enumeration element offers — `OfferedMembers` over the configuration store, the adapter half of AD-4
 * for task 79.7.
 *
 * `AxisShapeService`'s shape: **validated, never cast**, and cached per configuration revision.
 *
 * **It fails open, toward the domain**, which is the applicability service's direction rather than the axis shapes':
 * an unreadable payload or a malformed entry narrows nothing, so the element offers every member its domain declares —
 * the taxonomy's own list, which a filing may carry — and an operator reads the line. The other failure is a choice
 * field with nothing to choose, which a reporter cannot answer at all.
 */
@Injectable()
export class OfferedMembersService implements OfferedMembers {
  private readonly logger = new Logger(OfferedMembersService.name);

  private readonly cache = new Map<string, { revision: number; offered: ReadonlyMap<string, ReadonlySet<string>> }>();

  constructor(private readonly configurationStore: ConfigurationStore) {}

  offered(query: { readonly standard: string }): ReadonlyMap<string, ReadonlySet<string>> {
    const entry = this.configurationStore.get({ kind: DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND, scope: query.standard });
    // No entry is not a defect: a standard nobody has narrowed offers every domain whole.
    if (!entry) return NONE;

    const key = `${DISCLOSURE_OFFERED_MEMBERS_CONFIG_KIND}/${query.standard}`;
    const cached = this.cache.get(key);
    if (cached?.revision === entry.revision) return cached.offered;

    const offered = this.read(entry.payload, key, entry.revision);
    this.cache.set(key, { revision: entry.revision, offered });
    return offered;
  }

  /** The entries, each whole or not at all: half a list would offer members nobody chose to offer. */
  private read(payload: unknown, key: string, revision: number): ReadonlyMap<string, ReadonlySet<string>> {
    const named: unknown = isRecord(payload) ? payload.elements : undefined;
    if (!isRecord(named)) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) carries no \`elements\` object — every choice field offers ` +
          `its whole domain instead.`,
      );
      return NONE;
    }
    const offered = new Map<string, ReadonlySet<string>>();
    const dropped: string[] = [];
    for (const [element, members] of Object.entries(named)) {
      const valid =
        Array.isArray(members) &&
        members.length > 0 &&
        members.every((member) => typeof member === 'string' && member !== '' && !member.includes(':'));
      if (valid) offered.set(element, new Set(members as string[]));
      else dropped.push(element);
    }
    if (dropped.length > 0) {
      this.logger.error(
        `Configuration entry ${key} (revision ${revision}) narrows ${dropped.join(', ')} with no list of bare member ` +
          `names, dropped — each offers its whole domain instead.`,
      );
    }
    return offered;
  }
}
