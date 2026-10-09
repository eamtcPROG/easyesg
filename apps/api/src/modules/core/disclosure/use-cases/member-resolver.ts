import type { DisclosureLabel, Locale } from '@easyesg/i18n';
import {
  ENUMERATION_TAXONOMY,
  type EnumerationTaxonomy,
  type RegisteredTaxonomy,
  type TaxonomyAxis,
  type TaxonomyElement,
  type TaxonomyMember,
  type TaxonomyRegistry,
} from '@api/contracts/taxonomy-registry.port';
import { PUBLISHED_CLASSIFICATION_LOCALE } from '../constants/classification.constants';
import { answerableMembers } from '../models/axis-leaves';
import { NO_DIMENSION } from '../models/disclosure-value.model';
import type { DisclosureAxis } from '../models/wizard-step.model';

/**
 * An element's member-keyed rows, and what to call each one (task 36.4).
 *
 * **Resolved once per axis, not once per field** — `OptionResolver`'s reason exactly: three B3
 * elements share `BreakdownOfEnergyConsumptionAxis`, so a per-field lookup would ask the registry
 * three times for one answer.
 *
 * **Which axes expand is configuration, not a property of the axis** (AD-4; the reasoning is on
 * `DISCLOSURE_AXIS_SHAPE_CONFIG_KIND`). An explicit axis says an element is reported along a fixed
 * domain and says nothing about how it is answered: energy's two members are a breakdown a reporter
 * fills, B4's 94 pollutants are a domain they pick from. Nothing in EFRAG's package tells them
 * apart, so an axis expands when the standard's registered shape says it does — and every axis
 * nobody has registered keeps the single undimensioned row it had before this task.
 *
 * **Beside the use case rather than in `domain/`, because it reads the registry** and keeps what it read: one
 * resolver lives for one step read, and the caches are what it is for. It asks the registry for axes and nothing else,
 * which is all its type admits.
 */
export class MemberResolver {
  private readonly cache = new Map<string, readonly string[]>();

  /** A classification's answerable members, per axis — see `answerable`. */
  private readonly leaves = new Map<string, readonly TaxonomyMember[]>();

  /** Built on first use and reused: one resolver for 256 names, not 256 resolvers. */
  private regions: Intl.DisplayNames | undefined;

  constructor(
    private readonly input: {
      readonly registered: Pick<RegisteredTaxonomy, 'standard' | 'version'>;
      readonly taxonomy: Pick<TaxonomyRegistry, 'axis'>;
      readonly memberLabels: Readonly<Record<string, DisclosureLabel>> | null;
      readonly locale: Locale;
      readonly breakdownAxes: ReadonlySet<string>;
      readonly classificationAxes: ReadonlySet<string>;
    },
  ) {}

  /** The rows this element is reported along, `[]` where it is undimensioned, typed or a picker. */
  membersFor(element: TaxonomyElement): readonly string[] {
    const name = element.axes.find((axis) => this.input.breakdownAxes.has(axis));
    if (name === undefined) return [];
    const cached = this.cache.get(name);
    if (cached !== undefined) return cached;

    const axis = this.axis(name);
    // A typed axis registered as a breakdown is a contradiction the registry settles, not this: its
    // rows are identifiers the reporter supplies, so it keeps task 91.2's ordinals.
    const members =
      axis === null || axis.typed
        ? []
        : [
            ...(axis.defaultMember ? [axis.defaultMember] : []),
            ...axis.members.map((member) => member.key),
          ];
    this.cache.set(name, members);
    return members;
  }

  /**
   * The **classification** axis this element is reported along, or `null` (task 36.5).
   *
   * The complement of `membersFor`, over the same three shapes: an explicit axis nobody registered
   * as a breakdown is a domain the reporter *selects* from — B4's 94 pollutants, B7's 973 waste
   * categories — so its rows are the ones a report actually holds rather than one per member.
   *
   * **Typed axes are excluded here as well as there**, and for the same reason in the other
   * direction: a site is not chosen from a domain, it is named.
   */
  classificationFor(element: TaxonomyElement): string | null {
    const name = element.axes.find((axis) => this.input.classificationAxes.has(axis));
    if (name === undefined) return null;
    // A typed axis registered as a classification is a contradiction the registry settles, not
    // this — `membersFor`'s reason in the other direction: its rows are identifiers the reporter
    // supplies, so there is no domain to select from and it keeps task 91.2's ordinals.
    const axis = this.axis(name);
    return axis === null || axis.typed ? null : name;
  }

  /** The member's label in the request's locale; `null` for an undimensioned row. */
  labelFor(dimensionKey: string): string | null {
    if (dimensionKey === NO_DIMENSION) return null;
    return this.input.memberLabels?.[dimensionKey]?.text ?? null;
  }

  /**
   * One classification's domain, as the answers a picker offers.
   *
   * **The default member is deliberately NOT offered.** On a breakdown it leads, because it is the
   * total line a fact with no dimension is taken to mean; here it is the domain's own root — *Type
   * of pollutant* — and offering it would let a reporter file an amount against the category rather
   * than against a pollutant.
   */
  domainOf(name: string): DisclosureAxis | null {
    const axis = this.axis(name);
    if (axis === null || axis.typed) return null;

    /** The language a published name was shown in, where that is not the reader's (task 36.8). */
    let borrowed: Locale | null = null;
    const members = this.answerable(axis)
      .map((member) => {
        // The platform's own catalogue first, in the request's locale.
        const named = this.labelFor(member.key);
        const shape = { value: member.key, code: member.code, hazardous: member.hazardous };
        if (named !== null) return { ...shape, label: named };
        // Then the classification's own published name — its in-locale one where it has it, and
        // English otherwise, which for the EU List of Waste is every member.
        const own = member.labels[this.input.locale] ?? null;
        if (own !== null) return { ...shape, label: own };
        // Then the platform's own name, for a domain EFRAG *references* rather than words — B8's
        // 256 ISO 3166 codes, none of which is worded anywhere in the package (task 36.9). It is
        // resolved in the request's locale, so nothing is borrowed and the note below stays silent.
        const region = this.regionName(axis.memberTaxonomy, member.key);
        if (region !== null) return { ...shape, label: region };
        const english = member.labels[PUBLISHED_CLASSIFICATION_LOCALE] ?? null;
        if (english !== null) borrowed = PUBLISHED_CLASSIFICATION_LOCALE;
        // Never the member key, which is an XBRL identifier. The published code is the honest
        // middle step, as it is for an enumeration.
        return { ...shape, label: english };
      });

    return {
      key: name,
      label: axis.defaultMember === null ? null : this.labelFor(axis.defaultMember),
      members,
      memberLanguage: borrowed,
    };
  }

  /**
   * Does this axis admit that member as an **answer**? The domain's leaves, never a shape the store
   * happens to hold — and never a category (task 36.8).
   *
   * **One answer for three readers**, which is what the first version of the leaf rule was not: it
   * reached `domainOf`'s picker and left this and the write path accepting a category. A category
   * written by anything but the browser would then have drawn a row on every element of the axis
   * *and* been rendered `unnamed`, because the picker no longer carries it — a strictly worse
   * outcome than before the rule existed.
   */
  admits(query: { readonly axis: string; readonly member: string }): boolean {
    const axis = this.axis(query.axis);
    return axis !== null && this.answerable(axis).some((candidate) => candidate.key === query.member);
  }

  /**
   * A country's name in the reader's language, for an axis whose members EFRAG only references
   * (task 36.9).
   *
   * `CountryOfEmploymentContractAxis` carries 256 ISO 3166 codes and **not one of them is worded**
   * anywhere in the package or the catalogues — B8's picker would otherwise offer `AD, AE, AF`. The
   * names are the platform's to give, and `Intl.DisplayNames` is where they already are: 255 of the
   * 256 resolve in all three live locales, from data every Node ships.
   *
   * **This is not the formatting NFR-26 governs, and it is not banned here.** That rule forbids a
   * *format pattern chosen at a call site*, and its `new Intl.*` selector is scoped to `apps/web`,
   * `apps/admin` and `packages/ui` — the tiers that render. A display name is a locale-derived
   * lookup, which is the thing NFR-26 asks for rather than the thing it prohibits, and it is
   * resolved here for the reason every other member name is: the api names, the screen renders.
   *
   * **`fallback: 'none'`, so an unresolvable code answers nothing rather than itself.** One member
   * needs it — `NT`, the Neutral Zone, withdrawn from ISO 3166 in 1993 and still in EFRAG's list —
   * and a label that is its own key is the shape the user-facing-text rule refuses. The picker then
   * falls back to the code as a *reference*, which is that rule's own permitted case.
   */
  private regionName(memberTaxonomy: EnumerationTaxonomy | null, code: string): string | null {
    if (memberTaxonomy !== ENUMERATION_TAXONOMY.COUNTRY) return null;
    this.regions ??= new Intl.DisplayNames([this.input.locale], { type: 'region', fallback: 'none' });
    // `of` throws on a structurally invalid code rather than answering `undefined`.
    try {
      return this.regions.of(code) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * The members of a classification a reporter may answer — `models/axis-leaves.ts`'s rule, which is not this
   * resolver's. What is this resolver's is the **cache**: `admits` is asked once per stored row and would otherwise
   * rebuild the parent set each time.
   */
  private answerable(axis: TaxonomyAxis): readonly TaxonomyMember[] {
    const cached = this.leaves.get(axis.key);
    if (cached !== undefined) return cached;
    const answerable = answerableMembers(axis);
    this.leaves.set(axis.key, answerable);
    return answerable;
  }

  private axis(name: string): TaxonomyAxis | null {
    return this.input.taxonomy.axis({
      standard: this.input.registered.standard,
      version: this.input.registered.version,
      key: name,
    });
  }
}
