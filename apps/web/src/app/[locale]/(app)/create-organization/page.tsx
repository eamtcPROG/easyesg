import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { FOCUS_MEASURE, FocusColumn } from '@easyesg/ui';
import type { CountryLegalForms } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '@/server/api-client';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import {
  CreateOrganizationForm,
  type CountryOption,
} from '@/features/organization/components/create-organization-form';
import styles from '@/features/organization/components/create-organization.module.css';

/**
 * S-04 — Create organization · OA · UC-49 · Focus
 *
 * Reached when a signed-in user holds no membership (§4.3's *none* arm, task 25.4), and from the
 * switcher's *create another organization* when task 83 lands.
 *
 * **Focus here means the column, not the shell.** §4.6 lists the archetype's fixed elements as
 * "single column, centred, one primary action"; `FocusShell`'s dark header and footer are
 * `(identity)`'s chrome, and this screen already has chrome — the global tier renders above it
 * (task 30.1), which is exactly what the Workspace artboard draws. So it takes `FocusColumn`,
 * extracted for this screen, and the `<main>` landmark comes with it.
 *
 * **The client provider is namespace-scoped and mounted on the PAGE rather than a layout**, which
 * is a first. The two `(app)` screens outside `(workspace)` share no layout that could hold one,
 * and the alternative — mounting a provider in `(app)/layout.tsx` — would put a catalogue in the
 * bundle of every authenticated screen to serve two of them. The root layout ships
 * `messages={null}` on purpose (NFR-43), so a namespace reaches the browser only by being named.
 *
 * `design_spec.md` §5 owns this screen's content, controls and states, and **OQ-20 owns why it has
 * four fields where the prototype draws five** — closed 29 Aug 2026, after the row was held rather
 * than built against a disagreement between the artboard and three other sources.
 */
export const generateMetadata = localizedPageTitle('organization.create');

export default async function CreateOrganizationPage({ params }: { params: LocaleParams }) {
  // Sequential and not a waterfall to fix: `activateRequestLocale` calls `setRequestLocale`, and
  // `api-client` resolves `getLocale()` for `Accept-Language` — hoisting the read above it would
  // fetch before the locale exists and bring back problem text in the wrong language. The same
  // data dependency `organization-unavailable/page.tsx` records.
  await activateRequestLocale(params);
  const [outcome, t, messages] = await Promise.all([
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
    getTranslations('organization.create'),
    getMessages(),
  ]);

  /**
   * The countries the API accepts, named in the reader's language.
   *
   * **A country code is a key, never a label** (CLAUDE.md's user-facing-text rule): `MD` on a
   * screen is an internal identifier, and OQ-43 puts the wording in the release catalogue rather
   * than the store. A country registered ahead of its wording renders its key, which next-intl
   * makes visible rather than silent — the same trade the legal-form list takes.
   *
   * The lookup is the catalogue **object**, not `t(code)`, and that is forced rather than chosen:
   * the app's `IntlMessages` augmentation narrows the namespace's keys to the ones authored, so a
   * translator call typed to `'MD'` cannot be handed a value the API supplies. Casting it would be
   * an assertion that the API only ever answers what this catalogue happens to hold, which is the
   * opposite of what AD-4 makes true. Indexing a `Record<string, string>` states the real
   * relationship — an open set of keys against a closed set of words.
   *
   * An unreachable API yields an empty list, which the form renders as a select with no options
   * and a `required` rule that cannot be satisfied. That is honest and, unlike a hidden field,
   * visible: nobody creates an organization in a country the platform did not confirm it operates
   * in.
   */
  const labels: Readonly<Record<string, string>> = messages.organization.countries;
  const countries: CountryOption[] =
    outcome.status === API_OUTCOME.Ok
      ? outcome.value.items.map((entry) => ({
          code: entry.countryCode,
          label: labels[entry.countryCode] ?? entry.countryCode,
        }))
      : [];

  return (
    <FocusColumn measure={FOCUS_MEASURE.WIDE}>
      <h1 className={`t-heading-1 ${styles.title}`}>{t('title')}</h1>
      <p className={`t-body ${styles.subtitle}`}>{t('subtitle')}</p>
      <NextIntlClientProvider
        messages={{
          organization: { create: messages.organization.create },
          forms: messages.forms,
          identity: { unreachable: messages.identity.unreachable },
        }}
      >
        <CreateOrganizationForm countries={countries} />
      </NextIntlClientProvider>
      <p className={`t-caption ${styles.waiting}`}>{t('waitingForInvitation')}</p>
    </FocusColumn>
  );
}
