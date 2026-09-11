'use client';

import type {
  DisclosureAxis,
  DisclosureField as DisclosureFieldShape,
  DisclosureOption,
} from '@easyesg/contracts';
import { Fieldset } from '@easyesg/ui';
import { useTranslations } from 'next-intl';
import { useMemo, useState, type ReactNode } from 'react';
import type { StepClassificationEntry } from '../../../tools/step-layout';
import { MemberPicker, memberName } from '../controls/member-picker';
import { FIELD_MESSAGES, GROUP_MESSAGES } from '../shared/step-messages';

/**
 * One row of a classification: the member it reports, and every element reported for it (task 36.5).
 *
 * **A component rather than a branch, because a row that has no member yet holds the choice.** The
 * api serves a row per member the report already names plus one unassigned row; the reporter picks
 * a pollutant here, and nothing is written until a *value* follows — `blankRow`'s own rule, and the
 * reason the picked member is state rather than a write of its own. An empty row in the store would
 * be met on every later visit by whoever never finished filling it in.
 *
 * **One `useState`**, per the reducer rule: the chosen member is one value nothing else moves with.
 * The cells' drafts belong to their own controls, and they meet only in the key each write carries.
 */
export function ClassificationRow({
  entry,
  domain,
  axisNames,
  byValue,
  taken,
  readOnly,
  action,
  renderField,
}: {
  readonly entry: StepClassificationEntry;
  readonly domain: DisclosureAxis | undefined;
  /** What this app calls each axis, for the ones EFRAG's package words nowhere. */
  readonly axisNames: Readonly<Record<string, string>>;
  /**
   * The axis's members indexed by value, built once for the step.
   *
   * **The index rather than the resolved member**, because the row's member is not always
   * `entry.dimensionKey`: a member the reporter has just picked lives in this component's own state
   * until a value is written under it, so the parent cannot resolve it. Passing the pre-resolved
   * member made a just-chosen waste entry render *unnamed* — caught by the browser journey.
   */
  readonly byValue: ReadonlyMap<string, DisclosureOption>;
  readonly taken: ReadonlySet<string>;
  readonly readOnly: boolean;
  readonly action: ReactNode;
  readonly renderField: (field: DisclosureFieldShape, named?: string | null) => ReactNode;
}) {
  const tGroup = useTranslations(GROUP_MESSAGES);
  const tField = useTranslations(FIELD_MESSAGES);

  // The reporter's choice for a row the server served without one. `null` means *not chosen here*,
  // which is not the same as the server's `''` — a row the server DID key stays keyed.
  const [picked, setPicked] = useState<string | null>(null);

  // What to call the axis: its own domain's name where EFRAG publishes one, this app's otherwise,
  // and a neutral word if neither — never the axis key, which is an XBRL identifier.
  const axisName = domain?.label ?? axisNames[entry.axis] ?? tGroup('fallbackName');
  const member = entry.dimensionKey !== '' ? entry.dimensionKey : (picked ?? '');

  // **The legend names the member, never the axis key.** A member the pinned version words in no
  // locale falls back to a neutral word, on `renderField`'s own rule: an XBRL name may not reach a
  // reader, and an unnamed row is a visible defect rather than a plausible-looking wrong word.
  const legend =
    member === ''
      ? tGroup('unassignedRow', { name: axisName })
      : memberName(byValue.get(member), tField('unnamed'));

  /**
   * **Memoized, or it defeats the memo it feeds** (convention review at task 36's parent close,
   * 9 Sep 2026). `MemberPicker`'s filter has `labels` in its dependency array, and this object was
   * a fresh literal on every render — so the memo whose own docblock says it exists because
   * `reactCompiler` is off recomputed a filter, a `toLocaleLowerCase` and a `slice` over **842 waste
   * entries** on every autosave acknowledgement. `apps/web/CLAUDE.md` names this exact case: *"a
   * non-primitive passed as a prop into a `memo()`'d child, or into a `useEffect`/`useMemo`
   * dependency array — recreated each render, it defeats the thing it feeds"*.
   */
  const pickerLabels = useMemo(
    () => ({
      label: axisName,
      placeholder: tField('choose'),
      prompt: tField('choicePrompt'),
      empty: tField('choiceEmpty'),
      loading: tField('choiceLoading'),
      unnamed: tField('unnamed'),
      hazardous: tGroup('hazardous'),
      nonHazardous: tGroup('nonHazardous'),
      // **The wire decides whether to say it, and the catalogue says what** (task 36.8).
      // `memberLanguage` is `null` wherever the names are in the reader's own — B4's
      // pollutants are worded in the catalogues — so the note appears only where a domain is
      // published in a language the reader did not ask for, and stops appearing on its own
      // the day one is translated.
      language: domain?.memberLanguage == null ? null : tGroup('domainLanguage'),
    }),
    // `domain.memberLanguage` rather than `domain`: the object identity of the axis is not what
    // the wording depends on, and the axes list is itself memoized upstream.
    [axisName, tField, tGroup, domain?.memberLanguage],
  );

  return (
    <Fieldset
      // **The legend is marked too, not just the listbox** (WCAG 2.2 SC 3.1.2): once a member is
      // chosen its name IS the group's accessible name, so an English waste entry would otherwise
      // be announced as Romanian by the document's own `lang`. `Fieldset.legend` is a `ReactNode`,
      // which is what makes this one span rather than a prop on the component.
      legend={
        domain?.memberLanguage === null || domain === undefined || member === '' ? (
          legend
        ) : (
          <span lang={domain.memberLanguage}>{legend}</span>
        )
      }
      readOnly={readOnly}
      action={action}
    >
      {/* The picker only where the row has no member yet: once a value is stored under one, moving
          it would leave the old key's answers behind under a pollutant nobody reports. Changing an
          unanswered row costs nothing, which is why the choice stays open until then. */}
      {!readOnly && entry.dimensionKey === '' && domain !== undefined ? (
        <MemberPicker
          members={domain.members}
          chosen={member}
          taken={taken}
          onChoose={setPicked}
          // WCAG 2.2 SC 3.1.2: the api answers which language the names are in, so the listbox is
          // marked rather than left for a screen reader to pronounce as Romanian (task 36.8).
          memberLang={domain.memberLanguage}
          labels={pickerLabels}
        />
      ) : null}
      {/*
       * **The cells appear once the row is named, and that is a correctness rule before it is a
       * design one.** §7.3 keys a value by `(element, dimension, ordinal)`, and the step read
       * collects a classification's rows from the members a report *holds* — so an amount written
       * while `dimensionKey` is `''` would be stored under the undimensioned key and never read
       * back: a live row under a key nothing looks at, which is exactly the defect the typed facade
       * exists to prevent one layer down.
       *
       * It also matches the order EFRAG's own sheet asks in — `Row ID │ Pollutant │ air │ water │
       * soil`, filled left to right — so the reporter is never asked *how much* before *of what*.
       *
       * **The member reaches each cell through its own key**, so a row the reporter has just named
       * writes to that member rather than to the row the server served unassigned.
       */}
      {member === ''
        ? null
        : entry.fields.map((field) => renderField({ ...field, dimensionKey: member }))}
    </Fieldset>
  );
}
