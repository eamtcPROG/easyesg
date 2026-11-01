import { isSupportTopic, type SubmitSupportRequest } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';

/** S-34's fields as the form holds them — a topic not yet chosen is `''`, which the field's rule refuses. */
export interface ContactFields {
  readonly topic: string;
  readonly question: string;
  readonly replyLocale: Locale;
  readonly name: string;
  readonly email: string;
}

/**
 * The request S-34 sends (task 77; FR-212): **a signed-in reader's name and address are never sent** — the account's
 * travel instead, so a form that held stale values cannot send them — and a visitor's are trimmed. `null` for a topic
 * outside the six, which the form's rule stops before it gets here.
 */
export const contactRequestOf = (input: {
  readonly fields: ContactFields;
  readonly signedIn: boolean;
}): SubmitSupportRequest | null => {
  const { fields } = input;
  if (!isSupportTopic(fields.topic)) return null;
  return {
    topic: fields.topic,
    question: fields.question.trim(),
    replyLocale: fields.replyLocale,
    ...(input.signedIn ? {} : { name: fields.name.trim(), email: fields.email.trim() }),
  };
};

/** A visitor's address as the form judges it before sending — the shape alone; the api judges it again. */
export const looksLikeEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value.trim());
