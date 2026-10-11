import type { Export, ValidationFinding } from '@easyesg/contracts';
import { describe, expect, it } from 'vitest';
import { API_OUTCOME } from '@/lib/api-outcome';
import {
  DIALOGUE_EVENT,
  DIALOGUE_PHASE,
  acknowledgesFindings,
  dialogueReducer,
  initialDialogueState,
  type DialogueEvent,
  type DialogueState,
} from './export-dialogue';

const FINDINGS = [{ rule: 'b1-turnover' }] as unknown as readonly ValidationFinding[];
const QUEUED = { id: 'e1', status: 'requested' } as unknown as Export;
const UNREACHABLE = { status: API_OUTCOME.Unreachable } as const;

const run = (events: readonly DialogueEvent[], from: DialogueState = initialDialogueState('ro')): DialogueState =>
  events.reduce(dialogueReducer, from);

/** S-11's dialogue (task 47.3): the two decisions, the refusal for findings and its acknowledgement, and the queue. */
describe('the export dialogue', () => {
  it('starts on the PDF in the language it was given, choosing', () => {
    expect(initialDialogueState('en')).toEqual({ format: 'pdf', language: 'en', phase: { kind: 'choosing', failure: null } });
  });

  it('asks without the acknowledgement first, and with it only once the warning has listed the findings (182/20)', () => {
    const refused = run([{ type: DIALOGUE_EVENT.SUBMITTED }, { type: DIALOGUE_EVENT.REFUSED_FOR_FINDINGS, findings: FINDINGS }]);
    expect(acknowledgesFindings(initialDialogueState('ro').phase)).toBe(false);
    expect(refused.phase).toEqual({ kind: DIALOGUE_PHASE.UNRESOLVED, findings: FINDINGS, failure: null });
    expect(acknowledgesFindings(refused.phase)).toBe(true);
  });

  it('keeps the findings in view while the acknowledging retry runs, and returns to them with why if it fails', () => {
    const retrying = run([
      { type: DIALOGUE_EVENT.SUBMITTED },
      { type: DIALOGUE_EVENT.REFUSED_FOR_FINDINGS, findings: FINDINGS },
      { type: DIALOGUE_EVENT.SUBMITTED },
    ]);
    expect(retrying.phase).toEqual({ kind: DIALOGUE_PHASE.SUBMITTING, findings: FINDINGS });
    expect(dialogueReducer(retrying, { type: DIALOGUE_EVENT.FAILED, failure: UNREACHABLE }).phase).toEqual({
      kind: DIALOGUE_PHASE.UNRESOLVED,
      findings: FINDINGS,
      failure: UNREACHABLE,
    });
  });

  it('returns a first request that failed to the choice, with why', () => {
    expect(run([{ type: DIALOGUE_EVENT.SUBMITTED }, { type: DIALOGUE_EVENT.FAILED, failure: UNREACHABLE }]).phase).toEqual({
      kind: DIALOGUE_PHASE.CHOOSING,
      failure: UNREACHABLE,
    });
  });

  it('holds the decisions still while a request runs or an export is watched, and frees them on a restart', () => {
    const queued = run([{ type: DIALOGUE_EVENT.SUBMITTED }, { type: DIALOGUE_EVENT.QUEUED, export: QUEUED }]);
    expect(queued.phase).toEqual({ kind: DIALOGUE_PHASE.QUEUED, export: QUEUED });
    expect(dialogueReducer(queued, { type: DIALOGUE_EVENT.FORMAT_CHOSEN, format: 'xlsx' }).format).toBe('pdf');
    const restarted = dialogueReducer(queued, { type: DIALOGUE_EVENT.RESTARTED });
    expect(restarted.phase).toEqual({ kind: DIALOGUE_PHASE.CHOOSING, failure: null });
    expect(run([{ type: DIALOGUE_EVENT.LANGUAGE_CHOSEN, language: 'en' }], restarted).language).toBe('en');
  });

  it('keeps the warning when a decision changes — the findings are the report’s, whatever the file', () => {
    const refused = run([{ type: DIALOGUE_EVENT.SUBMITTED }, { type: DIALOGUE_EVENT.REFUSED_FOR_FINDINGS, findings: FINDINGS }]);
    const changed = dialogueReducer(refused, { type: DIALOGUE_EVENT.FORMAT_CHOSEN, format: 'xlsx' });
    expect(changed).toMatchObject({ format: 'xlsx', phase: { kind: DIALOGUE_PHASE.UNRESOLVED, findings: FINDINGS } });
  });
});
