import type { ContentKind } from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { TextArea, TextField } from '@easyesg/ui';
import { useTranslations } from 'use-intl';
import {
  FIELD_SHAPE,
  LOCALE_FIELDS,
  SHARED_FIELDS,
  localeValue,
  sharedValue,
  withLocaleField,
  withShared,
  type ContentField,
  type ContentPayload,
} from '../../../tools/content-payload';

/**
 * An item's fields, drawn from the kind's tables (task 67.5) — the shared ones once, or one locale's. **One generic form
 * for every kind and locale**, which is what lets a fourth locale arrive without code (FR-63). Each field's label is its
 * name under the catalogue; a list is one entry per line.
 */
export function ContentFields({
  kind,
  payload,
  locale,
  disabled,
  onChange,
}: {
  readonly kind: ContentKind;
  readonly payload: ContentPayload;
  /** A locale's fields, or the shared ones where null. */
  readonly locale: Locale | null;
  readonly disabled: boolean;
  readonly onChange: (next: ContentPayload) => void;
}) {
  const t = useTranslations('platform.content.fields');
  const fields = locale === null ? SHARED_FIELDS[kind] : LOCALE_FIELDS[kind];

  const valueOf = (field: ContentField) =>
    locale === null ? sharedValue(payload, field) : localeValue(payload, locale, field);
  const write = (field: ContentField, text: string) =>
    onChange(
      locale === null
        ? withShared({ payload, field, text })
        : withLocaleField({ kind, payload, locale, field, text }),
    );

  return (
    <div className="flex flex-col gap-[var(--space-4)]">
      {fields.map((field) =>
        field.shape === FIELD_SHAPE.PROSE || field.shape === FIELD_SHAPE.LINES ? (
          <TextArea
            key={field.name}
            label={t(`${field.name}.label`)}
            help={t(`${field.name}.help`)}
            value={valueOf(field)}
            disabled={disabled}
            rows={field.shape === FIELD_SHAPE.PROSE ? 3 : 4}
            onChange={(event) => write(field, event.currentTarget.value)}
          />
        ) : (
          <TextField
            key={field.name}
            label={t(`${field.name}.label`)}
            help={t(`${field.name}.help`)}
            value={valueOf(field)}
            disabled={disabled}
            inputMode={field.shape === FIELD_SHAPE.NUMBER ? 'numeric' : undefined}
            onChange={(event) => write(field, event.currentTarget.value)}
          />
        ),
      )}
    </div>
  );
}
