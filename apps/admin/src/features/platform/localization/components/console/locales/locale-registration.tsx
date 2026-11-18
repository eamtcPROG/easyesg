import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_OUTCOME, type ApiFailure } from '@easyesg/contracts';
import { LOCALES, SOURCE_LOCALE, type Locale } from '@easyesg/i18n';
import { Button, Checkbox, Fieldset, useDismissible } from '@easyesg/ui';
import { useState } from 'react';
import { useTranslations } from 'use-intl';
import { ExpiringRefusal } from '~/realm/components/shared/expiring-refusal';
import { CONTENT_CONSOLE_QUERY_KEY, publishLocaleRegistration } from '../../../queries/content-console';

/**
 * UC-73's control on A-03 (task 67.5; FR-63; 182/46): which built locales are offered. **Romanian is fixed** — the
 * source every other is translated from — and only the locales the build has a catalogue for are listed, since a
 * fourth is a catalogue and a release first (OQ-43). Saved against the revision read, so a colleague's later change is
 * refused rather than overwritten. Shown only to an operator who may publish content.
 *
 * The choice is one value with a lifecycle, and the save's refusal another, cleared when the choice changes — two
 * values, each a `useState`, since neither moves the other on its own events.
 */
export function LocaleRegistration({
  revision,
  codes,
}: {
  readonly revision: number;
  readonly codes: readonly string[];
}) {
  const t = useTranslations('platform.content.registration');
  const tLocales = useTranslations('platform.content.locales');
  const queryClient = useQueryClient();
  const [chosen, setChosen] = useState<readonly Locale[]>(LOCALES.filter((locale) => codes.includes(locale)));
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [shownFailure, dismissFailure] = useDismissible(failure);

  const { mutate: save, isPending } = useMutation({
    mutationFn: publishLocaleRegistration,
    onSuccess: async (outcome) => {
      if (outcome.status !== API_OUTCOME.Ok) {
        setFailure(outcome);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: CONTENT_CONSOLE_QUERY_KEY });
    },
  });

  return (
    <section aria-labelledby="content-registration" className="flex flex-col gap-[var(--space-3)]">
      <h2 id="content-registration" className="t-heading-3">
        {t('title')}
      </h2>
      <p className="t-body text-[var(--text-muted)]">{t('lede')}</p>
      <Fieldset legend={t('legend')}>
        {LOCALES.map((locale) => (
          <Checkbox
            key={locale}
            name="offered"
            value={locale}
            label={tLocales(locale)}
            help={locale === SOURCE_LOCALE ? t('sourceNote') : undefined}
            checked={chosen.includes(locale)}
            disabled={locale === SOURCE_LOCALE || isPending}
            onChange={(event) =>
              setChosen(
                event.currentTarget.checked
                  ? LOCALES.filter((candidate) => candidate === locale || chosen.includes(candidate))
                  : chosen.filter((candidate) => candidate !== locale),
              )
            }
          />
        ))}
      </Fieldset>
      <div>
        <Button
          type="button"
          busy={isPending}
          onClick={() => {
            setFailure(null);
            save({ codes: chosen, expectedRevision: revision });
          }}
        >
          {t('save')}
        </Button>
      </div>
      {shownFailure === null ? null : (
        <ExpiringRefusal failure={shownFailure} title={t('problemTitle')} fallback={t('problemBody')} onDismiss={dismissFailure} />
      )}
    </section>
  );
}
