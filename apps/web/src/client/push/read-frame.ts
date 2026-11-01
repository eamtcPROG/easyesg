import { isEventName, type EventFrame } from '@easyesg/contracts';

/**
 * A received message, read as AD-15's frame or as nothing (task 149).
 *
 * **Anything that is not exactly a frame of a catalogued event is dropped**, never thrown: a frame's only effect is a
 * refetch the poll would make anyway, so a message this client cannot read costs latency and nothing else. Only the
 * three fields are kept, so a field the api ever added could not reach a surface by default.
 */
export const readFrame = (data: unknown): EventFrame | null => {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { event, organizationId, since } = parsed as Record<string, unknown>;
  if (typeof event !== 'string' || !isEventName(event)) return null;
  if (typeof organizationId !== 'string' || organizationId === '') return null;
  if (typeof since !== 'number' || !Number.isSafeInteger(since)) return null;
  return { event, organizationId, since };
};
