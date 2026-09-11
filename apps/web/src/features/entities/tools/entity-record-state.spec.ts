import { CALLOUT_INTENT } from '@easyesg/ui';
import { describe, expect, it } from 'vitest';
import type { Notice } from '@/lib/notice';
import {
  ENTITY_EVENT,
  ENTITY_REPORT,
  codesChanged,
  entityRecordReducer,
  initialEntityRecordState,
  visibleNotice,
} from './entity-record-state';

const bread = { code: '10.71', label: 'Fabricarea pâinii' };
const pastry = { code: '10.72', label: 'Fabricarea biscuiților' };
const saved: Notice = { intent: CALLOUT_INTENT.SUCCESS, title: 'Salvat', body: 'Modificările au fost salvate.', action: null };
const refused: Notice = { intent: CALLOUT_INTENT.ERROR, title: 'Refuzat', body: 'Denumirea este obligatorie.', action: null };

describe('entityRecordReducer', () => {
  const initial = initialEntityRecordState([bread]);

  it('starts with nothing to report and the served codes as the reader’s', () => {
    expect(initial).toEqual({ report: null, served: [bread], codes: [bread], confirmingArchive: false });
    expect(codesChanged(initial)).toBe(false);
  });

  it('clears the previous outcome the moment a save leaves', () => {
    const before = entityRecordReducer(initial, { kind: ENTITY_EVENT.REFUSED, notice: refused });
    expect(entityRecordReducer(before, { kind: ENTITY_EVENT.SUBMITTED }).report).toBeNull();
  });

  it('makes the sent codes the stored ones on a save', () => {
    const edited = entityRecordReducer(initial, { kind: ENTITY_EVENT.CODES_CHANGED, codes: [bread, pastry] });
    expect(codesChanged(edited)).toBe(true);
    const after = entityRecordReducer(edited, { kind: ENTITY_EVENT.SAVED, notice: saved });
    expect(after.report).toEqual({ kind: ENTITY_REPORT.SAVED, notice: saved });
    expect(codesChanged(after)).toBe(false);
  });

  it('sees a code swapped for another, which the length alone cannot', () => {
    const swapped = entityRecordReducer(initial, { kind: ENTITY_EVENT.CODES_CHANGED, codes: [pastry] });
    expect(codesChanged(swapped)).toBe(true);
  });

  it('closes the archive dialogue on a refusal, whichever action was refused', () => {
    const asking = entityRecordReducer(initial, { kind: ENTITY_EVENT.ARCHIVE_REQUESTED });
    expect(asking.confirmingArchive).toBe(true);
    const after = entityRecordReducer(asking, { kind: ENTITY_EVENT.REFUSED, notice: refused });
    expect(after).toMatchObject({ confirmingArchive: false, report: { kind: ENTITY_REPORT.REFUSED } });
    expect(entityRecordReducer(asking, { kind: ENTITY_EVENT.ARCHIVE_DISMISSED }).confirmingArchive).toBe(false);
  });

  it('restores the stored codes and drops the report on a discard', () => {
    const edited = entityRecordReducer(
      entityRecordReducer(initial, { kind: ENTITY_EVENT.CODES_CHANGED, codes: [] }),
      { kind: ENTITY_EVENT.REFUSED, notice: refused },
    );
    const after = entityRecordReducer(edited, { kind: ENTITY_EVENT.DISCARDED });
    expect(after.codes).toEqual([bread]);
    expect(after.report).toBeNull();
  });
});

describe('visibleNotice', () => {
  const state = initialEntityRecordState([]);

  it('shows nothing when nothing was attempted', () => {
    expect(visibleNotice(state, false)).toBeNull();
  });

  it('hides a success the moment anything differs from what was saved', () => {
    const after = entityRecordReducer(state, { kind: ENTITY_EVENT.SAVED, notice: saved });
    expect(visibleNotice(after, false)).toBe(saved);
    expect(visibleNotice(after, true)).toBeNull();
  });

  it('keeps a refusal while the reader corrects it', () => {
    const after = entityRecordReducer(state, { kind: ENTITY_EVENT.REFUSED, notice: refused });
    expect(visibleNotice(after, true)).toBe(refused);
  });
});
