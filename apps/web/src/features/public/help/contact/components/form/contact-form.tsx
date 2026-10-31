'use client';

import { API_OUTCOME, SUPPORT_TOPIC } from '@easyesg/contracts';
import { LOCALES, type Locale } from '@easyesg/i18n';
import { Button, Callout } from '@easyesg/ui';
import { FormSelect, FormSummary, FormTextArea, FormTextField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { failureNotice, type Notice } from '@/lib/notice';
import { submitSupportRequestAction } from '../../actions/actions';
import { contactRequestOf, looksLikeEmail, type ContactFields } from '../../tools/contact-request';
import type { KnownReader } from '../../tools/known-reader';
import { ContactSent } from '../sent/contact-sent';
import { CONTACT_MESSAGES } from '../shared/contact-messages';
import styles from '../shared/contact.module.css';

/** The api's cost bounds (`SubmitSupportRequestDto`), restated so a reader meets them before sending. */
const QUESTION_MAX = 5000;
const NAME_MAX = 200;

/** What became of a send — one value, so the form never holds a reference and a refusal at once. File-internal. */
const CONTACT_OUTCOME = { SENT: 'sent', REFUSED: 'refused' } as const;

type Outcome =
  | { readonly kind: typeof CONTACT_OUTCOME.SENT; readonly reference: string }
  | { readonly kind: typeof CONTACT_OUTCOME.REFUSED; readonly notice: Notice };

/**
 * S-34 — UC-182's form (task 77.4; FR-212; `design_spec.md` S-34, Focus archetype). **A visitor gives a name and an
 * address; a signed-in reader is shown what travels instead** (UX-109's Redundant Entry), handed by the route as
 * `reader`, never read here. The topic decides only who reads it first, and the reply comes in the language chosen,
 * which starts from the page's.
 *
 * **Sent, it gives way to the reference** (S-34's `ready — sent`): the form is gone, so it cannot be sent twice by a
 * second press; a refusal stays above the form with the api's own words, and the fields keep what was typed.
 */
export function ContactForm({ reader, locale }: { readonly reader: KnownReader | null; readonly locale: Locale }) {
  const t = useTranslations(CONTACT_MESSAGES);
  const tLocales = useTranslations(`${CONTACT_MESSAGES}.replyLocale.options`);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startTransition] = useTransition();
  const { control, handleSubmit } = useForm<ContactFields>({
    mode: 'onTouched',
    defaultValues: { topic: '', question: '', replyLocale: locale, name: '', email: '' },
  });

  if (outcome?.kind === CONTACT_OUTCOME.SENT) return <ContactSent reference={outcome.reference} />;

  const submit = handleSubmit((fields) => {
    const request = contactRequestOf({ fields, signedIn: reader !== null });
    if (request === null) return;
    startTransition(async () => {
      const answer = await submitSupportRequestAction(request);
      setOutcome(
        answer.status === API_OUTCOME.Ok
          ? { kind: CONTACT_OUTCOME.SENT, reference: answer.value.reference }
          : { kind: CONTACT_OUTCOME.REFUSED, notice: failureNotice({ outcome: answer, unreachable: { title: t('unreachable.title'), body: t('unreachable.body') } }) },
      );
    });
  });

  return (
    <form method="post" noValidate className={styles.form} onSubmit={(event) => void submit(event)}>
      {outcome?.kind === CONTACT_OUTCOME.REFUSED ? (
        <Callout intent={outcome.notice.intent} title={outcome.notice.title} action={null}>
          {outcome.notice.body}
        </Callout>
      ) : null}
      <FormSummary control={control} title={t('summaryTitle')} />

      <FormSelect
        control={control}
        name="topic"
        label={t('topic.label')}
        help={t('topic.help')}
        placeholder={t('topic.placeholder')}
        options={Object.values(SUPPORT_TOPIC).map((topic) => ({ value: topic, label: t(`topic.options.${topic}`) }))}
        rules={{ required: t('topic.missing') }}
      />

      <FormTextArea
        control={control}
        name="question"
        label={t('question.label')}
        help={t('question.help')}
        rules={{
          required: t('question.missing'),
          validate: (value) => value.trim() !== '' || t('question.missing'),
          maxLength: { value: QUESTION_MAX, message: t('question.tooLong') },
        }}
      />

      <FormSelect
        control={control}
        name="replyLocale"
        label={t('replyLocale.label')}
        help={t('replyLocale.help')}
        options={LOCALES.map((code) => ({ value: code, label: tLocales(code) }))}
      />

      {reader === null ? (
        <>
          <FormTextField
            control={control}
            name="name"
            label={t('name.label')}
            autoComplete="name"
            rules={{
              required: t('name.missing'),
              validate: (value) => value.trim() !== '' || t('name.missing'),
              maxLength: { value: NAME_MAX, message: t('name.tooLong') },
            }}
          />
          <FormTextField
            control={control}
            name="email"
            type="email"
            label={t('email.label')}
            autoComplete="email"
            rules={{
              required: t('email.missing'),
              validate: (value) => looksLikeEmail(value) || t('email.invalid'),
            }}
          />
        </>
      ) : (
        <section aria-labelledby="contact-known" className={styles.known}>
          <h2 id="contact-known" className="t-heading-3">
            {t('known.heading')}
          </h2>
          <dl className={styles.facts}>
            <dt>{t('known.name')}</dt>
            <dd>{reader.name}</dd>
            <dt>{t('known.email')}</dt>
            <dd>{reader.email}</dd>
            {reader.organizationName === null ? null : (
              <>
                <dt>{t('known.organization')}</dt>
                <dd>{reader.organizationName}</dd>
              </>
            )}
          </dl>
        </section>
      )}

      <p className="t-body">{t('promise')}</p>
      <div>
        <Button type="submit" busy={pending}>
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
