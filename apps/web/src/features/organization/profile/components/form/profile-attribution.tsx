'use client';

import type { Organization } from '@easyesg/contracts';
import { useFormatter, useTranslations } from 'next-intl';
import { PROFILE_MESSAGES } from '../shared/profile-messages';

/**
 * FR-15's attribution line — who last changed the record, and when.
 *
 * **A top-level component, not a closure inside the form** (`rerender-no-inline-components`): a
 * component declared during render is a new type on every render, so React unmounts and remounts its
 * subtree rather than updating it. Here that is one line of text and costs nothing measurable —
 * which is precisely why it was worth fixing as a habit rather than after a profiler said so. Task
 * 129 gave it a file as well, which changes nothing about that argument and makes it visible.
 *
 * **Three sentences for three states**, because "nobody has changed it" and "we cannot say who did"
 * are different facts: `lastChange` is null when the trail holds nothing for this record, and its
 * `email` is null when the acting account has since been erased — the trail carries no foreign key
 * by design, so an attribution outlives the person it names (NFR-28). Neither is an error and
 * neither may be rendered as one.
 *
 * The moment is the catalogue's `stamp` format, whose own declaration names audit surfaces as its
 * consumers — a date and a time, from the active locale, with no pattern written here (NFR-26).
 *
 * **The *history* link the artboard draws is absent.** S-12 is task 84, appended when this screen
 * went looking for its owner and found none; a link to nothing is worse than no link.
 */
export function ProfileAttribution({
  lastChange,
}: {
  readonly lastChange: Organization['lastChange'];
}) {
  const t = useTranslations(PROFILE_MESSAGES);
  const format = useFormatter();

  if (lastChange === null) return <>{t('attribution.unknown')}</>;

  const at = format.dateTime(new Date(lastChange.at), 'stamp');
  return (
    <>
      {lastChange.email
        ? t('attribution.by', { email: lastChange.email, at })
        : t('attribution.anonymous', { at })}
    </>
  );
}
