import { CONTENT_KIND, type ContentKind } from '@easyesg/contracts';
import { SOURCE_LOCALE, type Locale } from '@easyesg/i18n';

/**
 * A-03's editing of an item, as pure operations over the payload the store holds (task 67.5; FR-61) — **one generic
 * editor over the three kinds**, the route's brief: what each kind asks per locale and once for every locale is the
 * tables below, and a fourth locale needs no code (FR-63). The kind's reader on the api judges the result at
 * publication; nothing here restates its rules beyond the shape the forms draw.
 */
export type ContentPayload = Record<string, unknown>;

/** How a field is drawn and stored: one line, several lines of prose, one entry per line, or a number. */
export const FIELD_SHAPE = {
  LINE: 'line',
  PROSE: 'prose',
  LINES: 'lines',
  NUMBER: 'number',
} as const;

export type FieldShape = (typeof FIELD_SHAPE)[keyof typeof FIELD_SHAPE];

/** Every field any kind carries — the payload's own keys, and the catalogue's leaves under `fields`. */
export const CONTENT_FIELD = {
  ORDER: 'order',
  TOPIC: 'topic',
  RELATED: 'related',
  TITLE: 'title',
  SUMMARY: 'summary',
  MODULE: 'module',
  NAME: 'name',
  HIGHLIGHTS: 'highlights',
  BADGE: 'badge',
} as const;

export type ContentFieldName = (typeof CONTENT_FIELD)[keyof typeof CONTENT_FIELD];

export interface ContentField {
  /** The payload's own key, and the catalogue leaf that names it. */
  readonly name: ContentFieldName;
  readonly shape: FieldShape;
  /** A field the reader accepts empty — a plan's badge. */
  readonly optional?: boolean;
}

/** What a kind asks once for every locale. */
export const SHARED_FIELDS: Readonly<Record<ContentKind, readonly ContentField[]>> = {
  [CONTENT_KIND.HELP_TOPIC]: [{ name: CONTENT_FIELD.ORDER, shape: FIELD_SHAPE.NUMBER }],
  [CONTENT_KIND.HELP_ARTICLE]: [
    { name: CONTENT_FIELD.TOPIC, shape: FIELD_SHAPE.LINE },
    { name: CONTENT_FIELD.ORDER, shape: FIELD_SHAPE.NUMBER },
    { name: CONTENT_FIELD.RELATED, shape: FIELD_SHAPE.LINES, optional: true },
  ],
  [CONTENT_KIND.PLAN_COPY]: [{ name: CONTENT_FIELD.ORDER, shape: FIELD_SHAPE.NUMBER }],
};

/** What a kind asks in each locale; an article's sections are edited apart (`sectionsOf`). */
export const LOCALE_FIELDS: Readonly<Record<ContentKind, readonly ContentField[]>> = {
  [CONTENT_KIND.HELP_TOPIC]: [
    { name: CONTENT_FIELD.TITLE, shape: FIELD_SHAPE.LINE },
    { name: CONTENT_FIELD.SUMMARY, shape: FIELD_SHAPE.PROSE },
  ],
  [CONTENT_KIND.HELP_ARTICLE]: [
    { name: CONTENT_FIELD.TITLE, shape: FIELD_SHAPE.LINE },
    { name: CONTENT_FIELD.SUMMARY, shape: FIELD_SHAPE.PROSE },
    { name: CONTENT_FIELD.MODULE, shape: FIELD_SHAPE.LINE },
  ],
  [CONTENT_KIND.PLAN_COPY]: [
    { name: CONTENT_FIELD.NAME, shape: FIELD_SHAPE.LINE },
    { name: CONTENT_FIELD.SUMMARY, shape: FIELD_SHAPE.PROSE },
    { name: CONTENT_FIELD.HIGHLIGHTS, shape: FIELD_SHAPE.LINES },
    { name: CONTENT_FIELD.BADGE, shape: FIELD_SHAPE.LINE, optional: true },
  ],
};

export interface ContentSection {
  readonly heading: string;
  readonly body: string;
  readonly disclosed: boolean;
}

const EMPTY_SECTION: ContentSection = { heading: '', body: '', disclosed: false };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** A locale's empty block, as each kind's reader expects one to be filled in. */
const emptyBlock = (kind: ContentKind): Record<string, unknown> => {
  switch (kind) {
    case CONTENT_KIND.HELP_TOPIC:
      return { title: '', summary: '' };
    case CONTENT_KIND.HELP_ARTICLE:
      return { title: '', summary: '', module: '', sections: [EMPTY_SECTION] };
    case CONTENT_KIND.PLAN_COPY:
      return { name: '', summary: '', highlights: [], badge: null };
  }
};

/** A new item's first draft: its shared fields, and an empty Romanian block — Romanian is the source (OQ-43). */
export const emptyPayload = (kind: ContentKind): ContentPayload => {
  const shared: Record<string, unknown> =
    kind === CONTENT_KIND.HELP_ARTICLE ? { topic: '', order: 1, related: [] } : { order: 1 };
  return { ...shared, locales: { ro: emptyBlock(kind) } };
};

const localesOf = (payload: ContentPayload): Record<string, unknown> =>
  isRecord(payload.locales) ? payload.locales : {};

/** The locale's block, or null where the item carries none in it — a locale not yet translated. */
export const blockOf = (payload: ContentPayload, locale: Locale): Record<string, unknown> | null => {
  const block = localesOf(payload)[locale];
  return isRecord(block) ? block : null;
};

/** A shared field's value as its form draws it: a number as text, a list as one entry per line. */
export const sharedValue = (payload: ContentPayload, field: ContentField): string => fieldText(payload[field.name], field);

/** A locale field's value as its form draws it; empty where the locale carries no block. */
export const localeValue = (payload: ContentPayload, locale: Locale, field: ContentField): string =>
  fieldText(blockOf(payload, locale)?.[field.name], field);

const fieldText = (value: unknown, field: ContentField): string => {
  if (field.shape === FIELD_SHAPE.LINES) return Array.isArray(value) ? value.filter((v) => typeof v === 'string').join('\n') : '';
  if (field.shape === FIELD_SHAPE.NUMBER) return typeof value === 'number' ? String(value) : '';
  return typeof value === 'string' ? value : '';
};

/** The form's text stored as the field's shape: lines split and blanks dropped, a number parsed, an empty optional null. */
const fieldValue = (text: string, field: ContentField): unknown => {
  if (field.shape === FIELD_SHAPE.LINES) return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
  if (field.shape === FIELD_SHAPE.NUMBER) {
    const parsed = Number.parseInt(text, 10);
    return Number.isNaN(parsed) ? text : parsed;
  }
  return field.optional === true && text.trim() === '' ? null : text;
};

export const withShared = (input: {
  readonly payload: ContentPayload;
  readonly field: ContentField;
  readonly text: string;
}): ContentPayload => ({ ...input.payload, [input.field.name]: fieldValue(input.text, input.field) });

/** A locale field set — the locale's block made from the kind's empty one where the item carried none. */
export const withLocaleField = (input: {
  readonly kind: ContentKind;
  readonly payload: ContentPayload;
  readonly locale: Locale;
  readonly field: ContentField;
  readonly text: string;
}): ContentPayload => {
  const block = blockOf(input.payload, input.locale) ?? emptyBlock(input.kind);
  return {
    ...input.payload,
    locales: {
      ...localesOf(input.payload),
      [input.locale]: { ...block, [input.field.name]: fieldValue(input.text, input.field) },
    },
  };
};

/**
 * The locale's block removed — a translation withdrawn, so readers in that locale are served Romanian and FR-64's queue
 * gathers them. **Romanian is never removed**: it is the source every other locale falls back to.
 */
export const withoutLocale = (payload: ContentPayload, locale: Locale): ContentPayload => {
  if (locale === SOURCE_LOCALE) return payload;
  const { [locale]: _removed, ...rest } = localesOf(payload);
  return { ...payload, locales: rest };
};

/** An article's sections in a locale, as the form draws them. */
export const sectionsOf = (payload: ContentPayload, locale: Locale): readonly ContentSection[] => {
  const sections = blockOf(payload, locale)?.sections;
  if (!Array.isArray(sections)) return [];
  return sections.map((section) =>
    isRecord(section)
      ? {
          heading: typeof section.heading === 'string' ? section.heading : '',
          body: typeof section.body === 'string' ? section.body : '',
          disclosed: section.disclosed === true,
        }
      : EMPTY_SECTION,
  );
};

/** An article's sections replaced in a locale — an edit, an addition or a removal composed by the caller. */
export const withSections = (input: {
  readonly payload: ContentPayload;
  readonly locale: Locale;
  readonly sections: readonly ContentSection[];
}): ContentPayload => {
  const block = blockOf(input.payload, input.locale) ?? emptyBlock(CONTENT_KIND.HELP_ARTICLE);
  return {
    ...input.payload,
    locales: { ...localesOf(input.payload), [input.locale]: { ...block, sections: input.sections } },
  };
};

export const EMPTY_CONTENT_SECTION = EMPTY_SECTION;

/** The item's Romanian title or name — how the list and the dialogue name it; the key where it has none yet. */
export const itemTitle = (input: { readonly payload: ContentPayload | null; readonly key: string }): string => {
  const block = input.payload === null ? null : blockOf(input.payload, 'ro');
  const title = block?.title ?? block?.name;
  return typeof title === 'string' && title.trim() !== '' ? title : input.key;
};
