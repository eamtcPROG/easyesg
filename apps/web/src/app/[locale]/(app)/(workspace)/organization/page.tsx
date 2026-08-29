import { Callout, CALLOUT_INTENT, TextLink } from '@easyesg/ui';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { OrganizationProfileForm } from '@/features/organization/components/organization-profile-form';
import { readOrganizationProfile, type OrganizationProfileRead } from '@/server/data/organization-profile';
import { TENANT_READ } from '@/server/data/tenant-read';
import { Link } from '@/i18n/navigation';
import { activateRequestLocale, localizedPageTitle, type LocaleParams } from '@/i18n/page';
import { ROUTES } from '@/lib/routes';
import styles from '@/features/organization/components/organization-profile.module.css';

/**
 * S-15 — Organization profile and identifiers · OA · UC-50, UC-51 · Record
 *
 * The legal identity that propagates into every report the organization produces (FR-15), and
 * FR-16's identifiers — **IDNO primary, LEI optional** (OQ-18; DUNS, EU ID and PermID are not
 * modelled and this screen must not offer them).
 *
 * **The screen never computes the caller's role.** `OrganizationController` carries
 * `@RequiresRole(ORGANIZATION_ADMINISTRATOR)` at class level, so an editor or a viewer is refused
 * and this renders the permission state from that refusal — S-16's rule, and one fewer place for
 * this tier's belief about a role to disagree with the server's.
 *
 * **Three of the prototype's regions are deliberately absent**, each with an owner elsewhere:
 * VAT registration, the e-Factura recipient and the callout about issued invoices are FR-106's
 * billing account and belong to S-23, and a default report language is not an organization setting
 * at all — FR-52 makes export language a choice taken per export, at S-11. `design_spec.md` S-15
 * records all three, and the *report-cover contact* is the fourth, which turned out to be a real
 * field nobody had written down and now amends FR-15.
 *
 * **The catalogue reaches the browser namespace-scoped and from the page**, as S-04's does and for
 * the same two reasons: the `(workspace)` layout's provider does not carry `organization.profile`,
 * and the root layout ships `messages={null}` on purpose (NFR-43).
 *
 * States (§8.1): error — permission · error — recoverable · ready. The form owns the rest.
 */
const MESSAGES = 'organization.profile';

export const generateMetadata = localizedPageTitle(MESSAGES);

export default async function OrganizationProfilePage({ params }: { params: LocaleParams }) {
  // Sequential, and a data dependency rather than the waterfall `async-parallel` names:
  // `activateRequestLocale` pins the locale `api-client` resolves for `Accept-Language`, so a read
  // hoisted above it would bring back problem text in the wrong language.
  await activateRequestLocale(params);
  const [read, t, messages] = await Promise.all([
    readOrganizationProfile(),
    getTranslations(MESSAGES),
    getMessages(),
  ]);

  return (
    <div className={styles.screen}>
      <ProfileScreenBody read={read} messages={messages} />
      {read.status === TENANT_READ.READY ? null : (
        <p className={`t-caption ${styles.footnote}`}>{t('lede')}</p>
      )}
    </div>
  );
}

/**
 * The read's three arms, as a top-level component rather than a closure — the shape
 * `rerender-no-inline-components` names, and S-16's page makes the same move for the same reason.
 */
async function ProfileScreenBody({
  read,
  messages,
}: {
  readonly read: OrganizationProfileRead;
  readonly messages: Awaited<ReturnType<typeof getMessages>>;
}) {
  const t = await getTranslations(MESSAGES);

  if (read.status === TENANT_READ.FORBIDDEN) {
    return (
      <Callout
        intent={CALLOUT_INTENT.WARNING}
        title={t('error.permission.title')}
        action={
          <TextLink asChild>
            <Link href={ROUTES.HOME}>{t('error.permission.action')}</Link>
          </TextLink>
        }
      >
        {t('error.permission.body')}
      </Callout>
    );
  }

  if (read.status === TENANT_READ.UNREACHABLE) {
    return (
      <Callout
        intent={CALLOUT_INTENT.ERROR}
        title={t('error.unreachable.title')}
        action={t('error.unreachable.action')}
      >
        {t('error.unreachable.body')}
      </Callout>
    );
  }

  // Keys resolved to words here, where the catalogue object can be indexed — see
  // `VocabularyOption`'s docblock for why a translator call cannot take these values.
  const countryLabels: Readonly<Record<string, string>> = messages.organization.countries;
  const formLabels: Readonly<Record<string, string>> = messages.organization.legalForms;
  const countries = read.countries.map((country) => ({
    value: country.countryCode,
    label: countryLabels[country.countryCode] ?? country.countryCode,
    legalForms: country.legalForms.map((form) => ({
      value: form,
      label: formLabels[form] ?? form,
    })),
  }));

  return (
    <NextIntlClientProvider
      messages={{
        organization: { profile: messages.organization.profile },
        forms: messages.forms,
        identity: { unreachable: messages.identity.unreachable },
      }}
    >
      <OrganizationProfileForm organization={read.organization} countries={countries} />
    </NextIntlClientProvider>
  );
}
