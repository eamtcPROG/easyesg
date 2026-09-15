'use client';

import { Combobox, type ComboboxOption } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import type { DisclosureOption } from '@easyesg/contracts';
import { FIELD_MESSAGES, GROUP_MESSAGES } from '../shared/step-messages';

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
 *
 * **Its words are its own** (task 158), from the field and group namespaces; the axis's name is the one
 * string passed in, because it is the domain's own where EFRAG publishes one. The row used to build a
 * `labels` object for this control and memoize it, or the filter below — which depended on it —
 * recomputed over the whole domain on every autosave tick. The filter now depends on the words
 * themselves, which are strings, so there is no object whose identity has to be kept stable.
 */
export function MemberPicker({
  members,
  chosen,
  taken,
  onChoose,
  label,
  memberLang,
}: {
  readonly members: readonly DisclosureOption[];
  /** The member this row reports, or `''` while it has none. */
  readonly chosen: string;
  /** Members other rows already report — offered to nobody, including this row's own. */
  readonly taken: ReadonlySet<string>;
  readonly onChoose: (member: string) => void;
  /** What the row's axis is called — the domain's name where EFRAG publishes one, the row's otherwise. */
  readonly label: string;
  /**
   * The BCP 47 tag the member names are written in, where that is not the page's (WCAG 2.2 SC
   * 3.1.2). `null` is the ordinary case and marks nothing.
   */
  readonly memberLang: string | null;
}) {
  const tField = useTranslations(FIELD_MESSAGES);
  const tGroup = useTranslations(GROUP_MESSAGES);
  // For a member the pinned version names in no locale the platform holds — never its key.
  const unnamed = tField('unnamed');
  // EFRAG's own distinction, said in the reader's language rather than left in the member key.
  const hazardous = tGroup('hazardous');
  const nonHazardous = tGroup('nonHazardous');
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
          memberName(member, unnamed).toLocaleLowerCase().includes(needle) ||
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
        label: memberName(member, unnamed),
        // The code where there is one, and the hazard mark where the classification makes the
        // distinction — EFRAG's B7 instruction is *select a type of waste that is Hazardous or
        // Non-Hazardous*, and nothing else the reader sees says which this is (task 36.8).
        ...describe(member, { hazardous, nonHazardous }),
      }));
  }, [members, taken, chosen, query, unnamed, hazardous, nonHazardous]);

  return (
    <Combobox
      label={label}
      // `''` IS this control's *nothing chosen* (its own `ComboboxOption.value` doc says so), so an
      // unassigned row passes it through rather than translating it to `undefined`.
      value={chosen}
      onValueChange={onChoose}
      query={query}
      onQueryChange={setQuery}
      options={options}
      /*
       * **The wire decides whether to say it, and the catalogue says what** (task 36.8). `memberLang`
       * is `null` wherever the names are in the reader's own language — B4's pollutants are worded in
       * the catalogues — so the note appears only where a domain is published in a language the reader
       * did not ask for, and stops appearing on its own the day one is translated. EFRAG publishes the
       * EU List of Waste in English alone, so B7's reporter meets Romanian element labels above an
       * English picker; saying so is the on-screen counterpart of what UX-47 and UX-98 require of the
       * export, since an unexplained language switch mid-form is indistinguishable from a defect.
       *
       * It rides the anatomy's own help slot, which is where a note about the control belongs rather
       * than beside it: `Combobox` associates it with `aria-describedby`, so it is announced with the
       * field instead of being a sentence a screen reader meets on its own.
       */
      {...(memberLang === null ? {} : { help: tGroup('domainLanguage'), optionsLang: memberLang })}
      placeholder={tField('choose')}
      promptLabel={tField('choicePrompt')}
      emptyLabel={tField('choiceEmpty')}
      loadingLabel={tField('choiceLoading')}
    />
  );
}

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
  words: { readonly hazardous: string; readonly nonHazardous: string },
): { readonly description?: string } {
  const marks = [
    member.code,
    member.hazardous === null ? null : member.hazardous ? words.hazardous : words.nonHazardous,
  ].filter((mark): mark is string => mark !== null);
  return marks.length === 0 ? {} : { description: marks.join(' · ') };
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
