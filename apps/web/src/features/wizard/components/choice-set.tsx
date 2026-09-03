'use client';

import { Button, BUTTON_VARIANT, Combobox, type ComboboxOption } from '@easyesg/ui';
import { useMemo, useState } from 'react';
import type { DisclosureOption } from '@easyesg/contracts';
import { membersOf, draftOfMembers } from '../values';
import styles from './step.module.css';

/**
 * An `enumeration_set` answer — the members chosen, from a domain that may hold a thousand of them
 * (task 36.2).
 *
 * **A screen's arrangement of `Combobox`, not a new control**, which is exactly what S-13's activity
 * picker concluded for the same shape: what this needs is *add one, see what you have, remove one*,
 * and §11.5's unbuilt Multi-select entry would be an inventory addition whose only consumers already
 * have a simpler answer (`architecture.md` §12.5.6, task 30.4.3).
 *
 * **The filtering is local, and that is a measurement rather than a preference.** B1's activity
 * domain is 1 047 members — 98.7 KiB raw, **15.8 KiB gzipped** — which the step read already carries
 * (task 91.1). A search endpoint would cost a round trip per keystroke to avoid a payload the
 * response compresses to less than a photograph; S-13 debounces against a Server Action because its
 * classifier is *not* on the page, which is a different situation and not a precedent for this one.
 *
 * **Chosen members are removed from the offered set**, as the activity picker does: choosing twice
 * is not something the store would refuse — it would hold the member twice — so the control makes it
 * unrepresentable rather than refusing it afterwards.
 */
export function ChoiceSet({
  options,
  draft,
  onCommit,
  labels,
  readOnly,
  labelledBy,
}: {
  readonly options: readonly DisclosureOption[];
  /** The answer as stored: members separated by spaces. */
  readonly draft: string;
  readonly onCommit: (draft: string) => void;
  readonly labels: {
    readonly label: string;
    readonly placeholder: string;
    readonly prompt: string;
    readonly empty: string;
    readonly remove: (member: string) => string;
    readonly removeShort: string;
    readonly none: string;
    /** Named because the busy indicator is not the sole carrier of anything (Combobox's rule). */
    readonly loading: string;
    /** For a member the taxonomy names in no locale the platform holds — never its key. */
    readonly unnamed: string;
  };
  readonly readOnly: boolean;
  readonly labelledBy: string;
}) {
  // One value nothing else moves with — the case the reducer rule leaves to a single `useState`.
  const [query, setQuery] = useState('');
  const chosen = membersOf(draft);
  // Indexed once rather than a `find` per chosen member (`js-index-maps`), and **memoized**, because
  // the domain runs to 1 047 members while this re-renders on every autosave tick — the *expensive
  // derivation recomputed per render* case `apps/web/CLAUDE.md` names.
  const wording = useMemo(
    () => new Map(options.map((option) => [option.value, option] as const)),
    [options],
  );
  // **Never the member itself.** `DisclosureOption.value` is the taxonomy-qualified name —
  // `vsme:IndividualMember` — which the root file's user-facing-text rule forbids a reader being
  // shown. The published code is a reference someone can cite; the key is internal jargon.
  const wordFor = (member: string): string => {
    const option = wording.get(member);
    return option?.label ?? option?.code ?? labels.unnamed;
  };

  if (readOnly) {
    return chosen.length === 0 ? (
      <p className={styles.readOnlyEmpty}>{labels.none}</p>
    ) : (
      <p className={styles.readOnlyValue}>{chosen.map(wordFor).join(', ')}</p>
    );
  }

  // Local filtering over the domain the step already carries. Matches the reader's own words and
  // the classification's code, because a bookkeeper reading a bill knows `10.71` and not its name.
  const needle = query.trim().toLocaleLowerCase();
  // **One pass, and a `Set` for the exclusion** — the domain is 1 047 members and this runs on every
  // keystroke, so the chained `filter().filter().slice().map()` it replaces walked the list four
  // times over (`js-combine-iterations`, `js-set-map-lookups`). It stops at the cap rather than
  // filtering everything and discarding the tail.
  const held = new Set(chosen);
  const offered: ComboboxOption[] = [];
  for (const option of options) {
    if (offered.length >= MAX_OFFERED) break;
    if (held.has(option.value)) continue;
    if (
      needle !== '' &&
      !(option.label ?? '').toLocaleLowerCase().includes(needle) &&
      !(option.code ?? '').toLocaleLowerCase().includes(needle)
    ) {
      continue;
    }
    offered.push({
      value: option.value,
      label: option.label ?? option.code ?? labels.unnamed,
      ...(option.label !== null && option.code !== null ? { description: option.code } : {}),
    });
  }

  return (
    <div className={styles.choiceSet}>
      {chosen.length === 0 ? (
        <p className={styles.readOnlyEmpty}>{labels.none}</p>
      ) : (
        <ul className={styles.chosen}>
          {chosen.map((member) => (
            <li key={member} className={styles.chosenItem}>
              <span>{wordFor(member)}</span>
              <Button
                variant={BUTTON_VARIANT.SUBTLE}
                type="button"
                aria-label={labels.remove(wordFor(member))}
                onClick={() => onCommit(draftOfMembers(chosen.filter((held) => held !== member)))}
              >
                {labels.removeShort}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Combobox
        label={labels.label}
        labelHidden
        aria-labelledby={labelledBy}
        value=""
        onValueChange={(value) => {
          if (value === '') return;
          setQuery('');
          onCommit(draftOfMembers([...chosen, value]));
        }}
        query={query}
        onQueryChange={setQuery}
        options={offered}
        placeholder={labels.placeholder}
        promptLabel={labels.prompt}
        emptyLabel={labels.empty}
        loadingLabel={labels.loading}
      />
    </div>
  );
}

/**
 * How many matches the list offers at once.
 *
 * Not a limit on the domain — every member remains reachable by typing — but on what is rendered:
 * a thousand options in an open listbox is a scroll nobody uses and a paint the browser feels, and
 * a reporter who has typed nothing wants the first few, not all of them.
 */
const MAX_OFFERED = 50;
