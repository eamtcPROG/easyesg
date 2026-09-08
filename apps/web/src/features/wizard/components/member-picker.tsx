'use client';

import { Combobox, type ComboboxOption } from '@easyesg/ui';
import { useMemo, useState } from 'react';
import type { DisclosureOption } from '@easyesg/contracts';

/**
 * Which member a classification row reports — B4's pollutant, B7's waste category (task 36.5).
 *
 * **A screen's arrangement of `Combobox`, not a new control**, which is the conclusion `ChoiceSet`
 * reached one shape over and S-13's activity picker before it: what this needs is *find one in a
 * long list and name the row with it*, which is what `Combobox` is. §11.5's inventory gains nothing
 * from a second entry that differs only in arity (UX-89's test is a difference in **anatomy**).
 *
 * **The filtering is local, on `ChoiceSet`'s measurement rather than a new one.** 94 pollutants is a
 * fraction of the 1 047-member activity domain that read already carries, and the step serves the
 * domain once for the whole table rather than once per field — so a search endpoint would cost a
 * round trip per keystroke against a payload already in the page.
 *
 * **Chosen members are removed from the offered set**, exactly as `ChoiceSet` and the activity
 * picker do: two rows reporting the same pollutant would collide on §7.3's natural key, so the
 * control makes it unrepresentable rather than refusing it after the fact.
 */
export function MemberPicker({
  members,
  chosen,
  taken,
  onChoose,
  labels,
  memberLang,
}: {
  readonly members: readonly DisclosureOption[];
  /** The member this row reports, or `''` while it has none. */
  readonly chosen: string;
  /** Members other rows already report — offered to nobody, including this row's own. */
  readonly taken: ReadonlySet<string>;
  readonly onChoose: (member: string) => void;
  readonly labels: {
    readonly label: string;
    readonly placeholder: string;
    readonly prompt: string;
    readonly empty: string;
    readonly loading: string;
    /** For a member the pinned version names in no locale the platform holds — never its key. */
    readonly unnamed: string;
    /** EFRAG's own distinction, said in the reader's language rather than left in the member key. */
    readonly hazardous: string;
    readonly nonHazardous: string;
    /**
     * Said where the domain's names are not in the reader's language (task 36.8) — `null` where
     * they are, which is the ordinary case.
     *
     * EFRAG publishes the EU List of Waste in English alone, so B7's reporter meets Romanian
     * element labels above an English picker. Saying so here is the on-screen counterpart of what
     * UX-47 and UX-98 require of the export: an unexplained language switch mid-form is
     * indistinguishable from a defect.
     */
    readonly language: string | null;
  };
  /**
   * The BCP 47 tag the member names are written in, where that is not the page's (WCAG 2.2 SC
   * 3.1.2). `null` is the ordinary case and marks nothing.
   */
  readonly memberLang: string | null;
}) {
  // One value nothing else moves with — the case the reducer rule leaves to a single `useState`.
  const [query, setQuery] = useState('');

  // **Memoized, and this is one of the three cases `apps/web/CLAUDE.md` says bite with
  // `reactCompiler` off**: filtering a list, recomputed per render. This row re-renders on every
  // autosave transition while `members` moves only when the step does.
  const options = useMemo<readonly ComboboxOption[]>(() => {
    const needle = query.trim().toLocaleLowerCase();
    return members
      .filter((member) => member.value === chosen || !taken.has(member.value))
      // **Label OR code**, which is `ChoiceSet`'s own filter beside this one and was missed here
      // when this component was written (task 36.8). The code is the half a reporter has in hand:
      // B7's waste entries are matched against a waste manifest that carries `01 01 01` and not the
      // English sentence, and it is the only part of an entry that is language-independent — which
      // matters most in exactly the domain EFRAG publishes in one language.
      .filter(
        (member) =>
          needle === '' ||
          memberName(member, labels.unnamed).toLocaleLowerCase().includes(needle) ||
          (member.code ?? '').toLocaleLowerCase().includes(needle),
      )
      // **Capped, which `ChoiceSet` does three lines below its own filter and this did not**
      // (spec review, 8 Sep 2026). Not a limit on the domain — every member stays reachable by
      // typing — but on what is rendered: B7's waste list is 842 entries, and an open listbox
      // holding all of them is a scroll nobody uses and a paint NFR-43 has to pay for. The filter
      // was copied from `ChoiceSet` and the cap in the same loop was not.
      .slice(0, MAX_OFFERED)
      .map((member) => ({
        value: member.value,
        label: memberName(member, labels.unnamed),
        // The code where there is one, and the hazard mark where the classification makes the
        // distinction — EFRAG's B7 instruction is *select a type of waste that is Hazardous or
        // Non-Hazardous*, and nothing else the reader sees says which this is (task 36.8).
        ...describe(member, labels),
      }));
  }, [members, taken, chosen, query, labels]);

  return (
    <Combobox
      label={labels.label}
      // `''` IS this control's *nothing chosen* (its own `ComboboxOption.value` doc says so), so an
      // unassigned row passes it through rather than translating it to `undefined`.
      value={chosen}
      onValueChange={onChoose}
      query={query}
      onQueryChange={setQuery}
      options={options}
      // The anatomy's own help slot, which is where a note about the control belongs rather than
      // beside it: `Combobox` associates it with `aria-describedby`, so it is announced with the
      // field instead of being a sentence a screen reader meets on its own.
      {...(labels.language === null ? {} : { help: labels.language })}
      {...(memberLang === null ? {} : { optionsLang: memberLang })}
      placeholder={labels.placeholder}
      promptLabel={labels.prompt}
      emptyLabel={labels.empty}
      loadingLabel={labels.loading}
    />
  );
}

/**
 * What a member is called — **exported, because two components name the same member in one render**
 * (convention review, 8 Sep 2026).
 *
 * `MemberPicker` renders it as the combobox's chosen option and `ClassificationRow` as the legend
 * directly above it, so a copy per caller is the shape the root file's rule describes: each is
 * locally correct, and if either chain changes the legend and the picker name one pollutant two
 * ways with nothing failing.
 *
 * The stored value is the member's XBRL name, so falling back to it would print
 * `AmmoniaNH3Member` at a reporter — the shape the user-facing-text rule forbids. The
 * classification's own code is the honest middle step; a neutral word is the floor.
 */
/**
 * How many options an open listbox renders at once — `ChoiceSet`'s own cap, and its reason.
 *
 * Not a limit on the domain: every member stays reachable by typing, and the filter runs over all
 * of them. It bounds the *paint*, which is what NFR-43's interaction budget is spent on — B7's
 * waste list is 842 entries and B1's activity domain 1 047.
 */
const MAX_OFFERED = 50;

/** The second line under an option: its code, and whether the classification calls it hazardous. */
function describe(
  member: DisclosureOption,
  labels: { readonly hazardous: string; readonly nonHazardous: string },
): { readonly description?: string } {
  const marks = [
    member.code,
    member.hazardous === null ? null : member.hazardous ? labels.hazardous : labels.nonHazardous,
  ].filter((mark): mark is string => mark !== null);
  return marks.length === 0 ? {} : { description: marks.join(' · ') };
}

export const memberName = (member: DisclosureOption | undefined, unnamed: string): string =>
  member?.label ?? member?.code ?? unnamed;
