/**
 * The taxonomy registry, behind a port (P-7, FR-65 … FR-66).
 *
 * **It is in `contracts/` because it crosses a context boundary**, exactly as `entitlement.port.ts`
 * does in the other direction: `platform/taxonomy` owns the registry, and `core/period` and
 * `core/disclosure` are its consumers — a period pins a version at open (UC-56 step 3) and the
 * disclosure store reads element metadata to know what a stored row means. A `core` module
 * importing `platform/taxonomy`'s service directly would make the registry's *implementation* a
 * transitive dependency of the reporting core; what crosses here is four questions.
 *
 * **Nothing on this port is a version-agnostic answer, and that is DR-4 rather than ceremony.**
 * Every method takes the version it is asking about, because two registered versions coexist by
 * design (task 33.3) and a report pinned to the older one must resolve *its* elements years later.
 * A convenience overload answering "the current elements" is the shape that silently re-reads an
 * archived report against a taxonomy it was never authored under.
 */

/**
 * What a disclosure *is*, as a form and a validator branch on it — derived from the XBRL item type
 * rather than restating it (`xbrlType` is carried alongside for the export, which needs the
 * original).
 *
 * The unit-bearing XBRL types collapse to `NUMERIC`: a mass and a volume are the same control, a
 * number with a unit, and which units are offered is the taxonomy's business rather than the
 * renderer's. `tools/extract-vsme-taxonomy.mjs` owns the mapping and fails on a type it does not
 * know, so an unmapped type is a build failure rather than a field that renders as free text.
 */
/**
 * **Re-exported from `@easyesg/vsme`, which declares it** (task 34.2). §10.7 gives that package the
 * taxonomy model, and this port previously declared its own copy; two `as const` objects over one
 * closed set is the drift CLAUDE.md's rule exists to prevent, and nothing could have seen them
 * disagree. Re-exported rather than replaced at the call sites so this port stays the one surface a
 * consumer of the registry imports (ISP).
 */
import type { DisclosureKind } from '@easyesg/vsme';

export { DISCLOSURE_KIND } from '@easyesg/vsme';
export type { DisclosureKind } from '@easyesg/vsme';

/**
 * XBRL's two period types. A `duration` fact is reported *for* the period (energy consumed); an
 * `instant` fact is reported *as at* a moment in it (headcount on the closing date).
 *
 * It is on the port rather than inside the export adapter because the distinction is a reporting
 * rule, not a serialisation detail: the two are compared differently against the prior period
 * (FR-46) and carried forward differently.
 */
export const PERIOD_TYPE = { DURATION: 'duration', INSTANT: 'instant' } as const;
export type PeriodType = (typeof PERIOD_TYPE)[keyof typeof PERIOD_TYPE];

/** One reportable element of a registered taxonomy version. */
export interface TaxonomyElement {
  /** The VSME XBRL element local name — the value of `report_disclosure_value.element_key` (AD-3). */
  readonly key: string;
  /**
   * `B1` … `B11`, `C1` … `C9`, or **`null`** for the standard's three pillar-level catch-all
   * disclosures, which belong to Environment / Social / Governance rather than to a numbered
   * module. Null is a real answer here, not a missing one.
   */
  readonly module: string | null;
  /** EFRAG's own words for the presentation role, e.g. `[1090] B3 - Environment - …`. */
  readonly section: string;
  /** Order within the section, as the standard presents it. */
  readonly order: number;
  /** The presentation parent, which is what makes a line-items group renderable as a group. */
  readonly parent: string | null;
  readonly kind: DisclosureKind;
  /** The original XBRL item type — the export needs it; a form should branch on `kind`. */
  readonly xbrlType: string;
  readonly periodType: PeriodType;
  /** For an enumeration, the domain its permitted values are drawn from. */
  readonly domain: string | null;
  /**
   * The axes this element is reported along — empty for most of them. A non-empty list is what
   * makes `report_disclosure_value.dimension_key` meaningful for this element (§7.3).
   */
  readonly axes: readonly string[];
}

/** One reporting axis, with its members already resolved. */
export interface TaxonomyAxis {
  readonly key: string;
  /**
   * A **typed** axis takes an arbitrary identifier rather than a member — a site, a subsidiary, a
   * material — so it has no domain and no members, and a form renders it as a repeating group the
   * reporter adds rows to. An explicit axis renders as a choice among `members`.
   */
  readonly typed: boolean;
  /**
   * The member a fact carrying no dimension is taken to mean — the total line. Without it a report
   * holding only the breakdown looks like it is missing its total, and one holding only the total
   * looks undimensioned.
   */
  readonly defaultMember: string | null;
  /**
   * Every member the axis admits, in the standard's own order, **including those drawn from another
   * taxonomy**: B7's waste axis takes the EU List of Waste, which EFRAG publishes and versions
   * beside VSME. The adapter resolves that, so a caller never learns which artefact a member came
   * from — the alternative is every consumer of B7 knowing about a second seed file.
   */
  readonly members: readonly TaxonomyMember[];
}

/** One member of an axis's domain. */
export interface TaxonomyMember {
  readonly key: string;
  /**
   * The classification's own code where it has one — `01 01 01` for a waste category. Null for a
   * member that is not part of a coded classification, such as `RenewableEnergyMember`.
   */
  readonly code: string | null;
  /**
   * **Absent where the classification does not state it at that level.** A waste chapter carries no
   * hazard classification; its six-digit entries do. `null` and `false` are different answers, and
   * B7 reports on the second.
   */
  readonly hazardous: boolean | null;
  /**
   * The member's own name, where the classification publishes one — an external authority's text,
   * not this project's wording, which is why it is data rather than a catalogue key (NFR-24, and
   * the same reason `nace-code.md.json` carries names). Keyed by locale, and a locale it does not
   * carry is not an error: EFRAG publishes English only for the waste list, so `ro` and `ru` are
   * platform-authored and outstanding (T-14).
   */
  readonly labels: Readonly<Record<string, string>>;
}

/** A registered taxonomy version (FR-65). */
export interface RegisteredTaxonomy {
  readonly standard: string;
  /** EFRAG's own release identifier, `YYYY-MM-DD` (OQ-45, closed 29 Aug 2026). */
  readonly version: string;
  /** The modules this version carries, in the standard's order — `B1` … `C9`. */
  readonly modules: readonly string[];
  /** Every reportable element, ordered by module and then by the standard's own presentation order. */
  readonly elements: readonly TaxonomyElement[];
}

/** Which versions a report opened now would be pinned to (FR-66, DR-4). */
export interface TaxonomyPin {
  readonly standard: string;
  readonly taxonomyVersion: string;
  readonly templateVersion: string;
}

export interface TaxonomyRegistry {
  /**
   * The versions a period or report opened on `on` pins to — **the registry's answer to "which
   * version", never `max(registered)`**.
   *
   * The date EFRAG publishes a release and the date this platform adopts it are different facts
   * (OQ-45), and adopting the newest automatically is behaviour rather than data. Held as an
   * effective-dated configuration entry, so scheduling an adoption is a publish and not a release.
   *
   * A **calendar date**, not an instant (NFR-34): which taxonomy a period opened on 1 January is
   * bound to must not change with the reader's timezone. `null` when nothing is registered, which
   * is a refusal to guess — a report pinned to a version invented at the call site is the defect
   * DR-4 exists to prevent.
   */
  pinFor(query: { readonly on?: string }): TaxonomyPin | null;

  /** Every registered version of a standard, newest first — A-04's list, and 33.3's two. */
  registeredVersions(query: { readonly standard: string }): readonly string[];

  /**
   * One registered version in full. `null` when that version is not registered, which is how a
   * report pinned to a withdrawn version surfaces as an explicit failure rather than as an empty
   * form.
   */
  taxonomy(query: { readonly standard: string; readonly version: string }): RegisteredTaxonomy | null;

  /**
   * One element of one version. Separate from `taxonomy` for the access pattern rather than for
   * tidiness: rendering a module walks the ordered list once, while storing a value asks about a
   * single key and would otherwise scan 143 entries per field.
   *
   * Both string parameters are named for the reason CLAUDE.md gives: swapped positionally, a
   * version and an element key compile and answer `null`, which every caller reads as "no such
   * element".
   */
  element(query: {
    readonly standard: string;
    readonly version: string;
    readonly key: string;
  }): TaxonomyElement | null;

  /**
   * One axis of one version, with its members resolved — including a domain published in another
   * taxonomy. `null` when the version registers no such axis.
   */
  axis(query: {
    readonly standard: string;
    readonly version: string;
    readonly key: string;
  }): TaxonomyAxis | null;
}

/** DI token beside the interface, so a consumer imports one thing (CLAUDE.md, P-7). */
export const TAXONOMY_REGISTRY = Symbol('TAXONOMY_REGISTRY');
