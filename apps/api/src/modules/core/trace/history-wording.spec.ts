import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, leafKeys } from '@easyesg/i18n';
import { COMMITTED_CATALOGUES } from '@api/app/messages/committed-catalogues';
import { CONSOLIDATION_BASIS, ENTITY_STATUS } from '@api/modules/core/entity/models/reporting-entity.model';
import { HISTORY_SUBJECTS } from './domain/history-subjects';
import { VOCABULARY, type HistorySubjectKind, type Vocabulary } from './models/change-history.model';

const SEED = join(__dirname, '../../../../../../config/seed');
const LEGAL_FORM_ARTEFACT = /^organization-legal-form\.([a-z]{2})\.json$/;

/** The country registered by each legal-form artefact, and the forms it registers — read from the seed, never listed here. */
const registered = readdirSync(SEED).flatMap((file) => {
  const country = LEGAL_FORM_ARTEFACT.exec(file)?.[1];
  if (country === undefined) return [];
  const payload = JSON.parse(readFileSync(join(SEED, file), 'utf8')) as { forms: string[] };
  return [{ country: country.toUpperCase(), forms: payload.forms }];
});

/** Every member each closed vocabulary a history words can hold — the seed's, or the model's own vocabulary. */
const MEMBERS: Readonly<Record<Vocabulary, readonly string[]>> = {
  [VOCABULARY.LEGAL_FORMS]: registered.flatMap((entry) => entry.forms),
  [VOCABULARY.COUNTRIES]: registered.map((entry) => entry.country),
  [VOCABULARY.CONSOLIDATION_BASES]: Object.values(CONSOLIDATION_BASIS),
  [VOCABULARY.ENTITY_STATUSES]: Object.values(ENTITY_STATUS),
};

/**
 * **Every word S-12's history can state resolves in every locale** (task 84; §12.5.6's task-84 row (3), (e)): each
 * registered field's name, and every member of every closed vocabulary a field reads — a word the catalogue lacks
 * prints nothing (UX-97), so a missing one is a change the panel shows from nothing to nothing, or a name left blank.
 *
 * **The members are read from where they are true**: legal forms and countries from `config/seed`'s legal-form
 * artefacts — a country's forms are configuration, and can arrive with no catalogue edit (AD-4) — and the basis and
 * the standing from the entity model's own vocabularies.
 */
describe('the change history’s words', () => {
  const leaves = new Map(LOCALES.map((locale) => [locale, new Set(leafKeys(COMMITTED_CATALOGUES[locale]))]));
  const unworded = (keys: readonly string[]) =>
    LOCALES.flatMap((locale) => keys.filter((key) => !leaves.get(locale)?.has(key)).map((key) => `${locale}: ${key}`));

  it('reads at least one registered country, so the vocabulary cases below are about something', () => {
    expect(registered.length).toBeGreaterThan(0);
    expect(MEMBERS[VOCABULARY.LEGAL_FORMS].length).toBeGreaterThan(0);
  });

  it('names every field each subject can state', () => {
    const keys = (Object.entries(HISTORY_SUBJECTS) as [HistorySubjectKind, (typeof HISTORY_SUBJECTS)[HistorySubjectKind]][])
      .flatMap(([subject, shape]) =>
        shape.fields.filter((field) => field.subject !== true).map((field) => `core.trace.fields.${subject}.${field.key}`),
      );
    expect(unworded(keys)).toEqual([]);
  });

  it('words every member of every closed vocabulary a field reads', () => {
    const keys = (Object.entries(MEMBERS) as [Vocabulary, readonly string[]][]).flatMap(([vocabulary, members]) =>
      members.map((member) => `vocabulary.${vocabulary}.${member}`),
    );
    expect(unworded(keys)).toEqual([]);
  });

  it('words an activity code beside its label', () => {
    expect(unworded(['core.trace.activity'])).toEqual([]);
  });
});
