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
  };
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
      .filter((member) => needle === '' || memberName(member, labels.unnamed).toLocaleLowerCase().includes(needle))
      .map((member) => ({
        value: member.value,
        label: memberName(member, labels.unnamed),
        ...(member.label !== null && member.code !== null ? { description: member.code } : {}),
      }));
  }, [members, taken, chosen, query, labels.unnamed]);

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
export const memberName = (member: DisclosureOption | undefined, unnamed: string): string =>
  member?.label ?? member?.code ?? unnamed;
