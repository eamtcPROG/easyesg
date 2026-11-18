import type { Locale } from '@easyesg/i18n';
import { BUTTON_VARIANT, Button, Checkbox, Fieldset, TextArea, TextField } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import {
  EMPTY_CONTENT_SECTION,
  sectionsOf,
  withSections,
  type ContentPayload,
  type ContentSection,
} from '../../../tools/content-payload';

/**
 * An article's sections in one locale (task 67.5; task 76's anatomy): each a heading, a body in the help centre's small
 * Markdown subset, and whether the reader opens it — added, edited and removed in place. An article keeps at least
 * one, which its reader requires.
 */
export function ArticleSections({
  payload,
  locale,
  disabled,
  onChange,
}: {
  readonly payload: ContentPayload;
  readonly locale: Locale;
  readonly disabled: boolean;
  readonly onChange: (next: ContentPayload) => void;
}) {
  const t = useTranslations('platform.content.sections');
  const sections = sectionsOf(payload, locale);
  const write = (next: readonly ContentSection[]) => onChange(withSections({ payload, locale, sections: next }));
  const edit = (index: number, patch: Partial<ContentSection>) =>
    write(sections.map((section, at) => (at === index ? { ...section, ...patch } : section)));

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {sections.map((section, index) => (
        <Fieldset
          // A section has no identity beyond its place; the list is edited in place and never reordered.
          key={index}
          legend={t('legend', { number: index + 1 })}
          action={
            sections.length > 1 && !disabled ? (
              <Button
                type="button"
                variant={BUTTON_VARIANT.SECONDARY}
                onClick={() => write(sections.filter((_, at) => at !== index))}
              >
                {t('remove', { number: index + 1 })}
              </Button>
            ) : undefined
          }
        >
          <TextField
            label={t('heading')}
            value={section.heading}
            disabled={disabled}
            onChange={(event) => edit(index, { heading: event.currentTarget.value })}
          />
          <TextArea
            label={t('body')}
            help={t('bodyHelp')}
            rows={6}
            value={section.body}
            disabled={disabled}
            onChange={(event) => edit(index, { body: event.currentTarget.value })}
          />
          <Checkbox
            label={t('disclosed')}
            help={t('disclosedHelp')}
            checked={section.disclosed}
            disabled={disabled}
            onChange={(event) => edit(index, { disclosed: event.currentTarget.checked })}
          />
        </Fieldset>
      ))}
      {disabled ? null : (
        <div>
          <Button type="button" variant={BUTTON_VARIANT.SECONDARY} onClick={() => write([...sections, EMPTY_CONTENT_SECTION])}>
            {t('add')}
          </Button>
        </div>
      )}
    </div>
  );
}
