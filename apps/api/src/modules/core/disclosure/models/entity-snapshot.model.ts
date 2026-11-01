import type { ConsolidationBasis } from '@api/modules/core/entity/models/reporting-entity.model';

/**
 * FR-18's point-in-time master data, as B1's defaults read it (task 91.2; FR-27, UX-109).
 *
 * **A read model over `core.entity_snapshot`'s `payload`, not the entity.** The period took the
 * snapshot at open (task 31.1, §7.2), and what B1 pre-populates from is *that* — an entity edited
 * after the period opened does not move a filing already under way, which is the whole reason the
 * snapshot exists (architecture.md §12.5.6, task 29.4's row). Reading the live entity here would
 * be FR-18's failure at the one field where it is most expensive.
 *
 * **Every field is nullable or empty rather than required**, because the payload is whatever the
 * entity's columns were on the day: a snapshot taken before task 29.4 added the consolidation
 * boundary has no `consolidation_basis` key at all, and reads here as *unstated* rather than as a
 * malformed document.
 */
export interface SnapshotSite {
  readonly name: string;
  readonly addressLine1: string | null;
  readonly locality: string | null;
  readonly postalCode: string | null;
  readonly countryCode: string | null;
  /** Decimal degrees as strings, exactly as the entity holds them (AD-14 constraint 4). */
  readonly latitude: string | null;
  readonly longitude: string | null;
}

export interface SnapshotConsolidationMember {
  readonly name: string;
  readonly countryCode: string | null;
}

export interface EntitySnapshot {
  readonly takenAt: Date;
  readonly legalForm: string | null;
  readonly naceCodes: readonly string[];
  readonly consolidationBasis: ConsolidationBasis | null;
  /** In the snapshot's own order — by name, then id — which is the order B1's rows take. */
  readonly consolidationMembers: readonly SnapshotConsolidationMember[];
  readonly sites: readonly SnapshotSite[];
}
