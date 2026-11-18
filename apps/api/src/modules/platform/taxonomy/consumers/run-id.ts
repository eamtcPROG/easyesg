const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/** A run job's one field, validated rather than asserted over: a payload is data that crossed a process boundary. */
export function readRunId(input: { readonly payload: Record<string, unknown>; readonly job: string }): string {
  const { runId } = input.payload;
  if (typeof runId !== 'string' || !UUID.test(runId)) throw new Error(`${input.job} payload names no run.`);
  return runId;
}
