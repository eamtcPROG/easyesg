import {
  TAXONOMY_COMPATIBILITY,
  TAXONOMY_FIELD_CHANGE,
  type MappedField,
  type TaxonomyCompatibility,
  type TaxonomyFieldChange,
} from '@easyesg/contracts';

/**
 * A pair's mapping as A-04 edits it (tasks 67.21, 67.6; FR-67; 182/39, 182/40) — the determination and each field's
 * kind of change, from the stored mapping or the api's proposal. **One reducer**: loading a pair replaces both halves at
 * once, and marking a field removed or altered forces the determination the api would otherwise refuse.
 */
export interface MappingDraft {
  readonly determination: TaxonomyCompatibility;
  readonly fields: readonly MappedField[];
}

export const MAPPING_EVENT = {
  LOADED: 'loaded',
  DETERMINATION_CHOSEN: 'determination-chosen',
  FIELD_ADDED: 'field-added',
  FIELD_CHANGED: 'field-changed',
  FIELD_REMOVED: 'field-removed',
} as const;

export type MappingEvent =
  | { readonly type: typeof MAPPING_EVENT.LOADED; readonly mapping: MappingDraft }
  | { readonly type: typeof MAPPING_EVENT.DETERMINATION_CHOSEN; readonly determination: TaxonomyCompatibility }
  | { readonly type: typeof MAPPING_EVENT.FIELD_ADDED }
  | { readonly type: typeof MAPPING_EVENT.FIELD_CHANGED; readonly index: number; readonly field: MappedField }
  | { readonly type: typeof MAPPING_EVENT.FIELD_REMOVED; readonly index: number };

/** A pair that removes or alters a field is breaking (182/40): a report's answer to it cannot move unreviewed. */
export const determinationAdmitted = (draft: MappingDraft): boolean =>
  draft.determination === TAXONOMY_COMPATIBILITY.BREAKING ||
  draft.fields.every((field) => field.change === TAXONOMY_FIELD_CHANGE.ADDED);

const settle = (draft: MappingDraft): MappingDraft =>
  determinationAdmitted(draft) ? draft : { ...draft, determination: TAXONOMY_COMPATIBILITY.BREAKING };

export function mappingReducer(state: MappingDraft, event: MappingEvent): MappingDraft {
  switch (event.type) {
    case MAPPING_EVENT.LOADED:
      return { determination: event.mapping.determination, fields: [...event.mapping.fields] };
    case MAPPING_EVENT.DETERMINATION_CHOSEN:
      return settle({ ...state, determination: event.determination });
    case MAPPING_EVENT.FIELD_ADDED:
      return { ...state, fields: [...state.fields, { element: '', change: TAXONOMY_FIELD_CHANGE.ADDED }] };
    case MAPPING_EVENT.FIELD_CHANGED:
      return settle({ ...state, fields: state.fields.map((field, index) => (index === event.index ? event.field : field)) });
    case MAPPING_EVENT.FIELD_REMOVED:
      return { ...state, fields: state.fields.filter((_, index) => index !== event.index) };
  }
}

/** Fields worth sending: an element named. A row left blank is the operator's unfinished line, not a field. */
export const mappedFields = (draft: MappingDraft): readonly MappedField[] =>
  draft.fields.filter((field) => field.element.trim() !== '').map((field) => ({ ...field, element: field.element.trim() }));

export const isFieldChange = (value: string): value is TaxonomyFieldChange =>
  (Object.values(TAXONOMY_FIELD_CHANGE) as readonly string[]).includes(value);

export const isCompatibility = (value: string): value is TaxonomyCompatibility =>
  (Object.values(TAXONOMY_COMPATIBILITY) as readonly string[]).includes(value);
