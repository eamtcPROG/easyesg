'use client';

import { SUPPORT_TOPIC } from '@easyesg/contracts';
import { useBoundField } from '@easyesg/ui/forms';
import { useTranslations } from 'next-intl';
import type { Control } from 'react-hook-form';
import type { ContactFields } from '../../tools/contact-request';
import { CONTACT_MESSAGES } from '../shared/contact-messages';
import styles from '../shared/contact.module.css';

/**
 * S-34's topic as six choices (tasks 77, 227; artboard 04) — a radio group drawn as the artboard's chips, the one
 * chosen filled. **This app's, not the inventory's** (UX-89 as amended): only S-34 asks a question this way, and §11.5's
 * radio group is the B1 option cards' anatomy. **Bound through `useBoundField`**, so the id, the error and the summary's
 * link come from the same `control` the form's other fields use: the first choice carries the id, so the summary's link
 * lands focus in the group.
 */
export function TopicChoice({ control }: { readonly control: Control<ContactFields> }) {
  const t = useTranslations(CONTACT_MESSAGES);
  const { id, error, input } = useBoundField({ control, name: 'topic', rules: { required: t('topic.missing') } });
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;

  return (
    <fieldset className={styles.topic} aria-describedby={error === undefined ? helpId : `${errorId} ${helpId}`}>
      <legend className={styles.topicLegend}>{t('topic.label')}</legend>
      <p id={helpId} className={styles.hint}>
        {t('topic.help')}
      </p>
      {error === undefined ? null : (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
      {/* A radio takes no `aria-invalid`; the group's description carries the error, and the chips draw it. */}
      <div className={styles.chips} data-invalid={error === undefined ? undefined : 'true'}>
        {Object.values(SUPPORT_TOPIC).map((topic, index) => (
          <label key={topic} className={styles.chip}>
            <input
              type="radio"
              className={styles.chipInput}
              name={input.name}
              value={topic}
              checked={input.value === topic}
              onChange={() => input.onChange(topic)}
              onBlur={input.onBlur}
              id={index === 0 ? id : undefined}
              ref={index === 0 ? input.ref : undefined}
            />
            <span className={styles.chipLabel}>{t(`topic.options.${topic}`)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
