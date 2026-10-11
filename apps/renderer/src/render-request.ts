/** What the worker sends: the document's markup, and the moment it was produced, which the file's metadata carries. */
export interface RenderRequest {
  /** A whole HTML document — `REPORT_DOCUMENT_RENDERER`'s output, its styles and fonts inside it and no script. */
  readonly markup: string;
  /** The generation instant (NFR-22), epoch milliseconds — the one printed on the document's cover and provenance. */
  readonly generatedAt: number;
}

/** Why a body was refused, worded for the worker's log — this service has no reader but its one client. */
export class RenderRequestRefusedError extends Error {}

/**
 * Admits a request body or refuses it. A render is expensive and its input comes over the network, so a body that is
 * not exactly this shape is refused here rather than half-rendered.
 */
export function readRenderRequest(body: string): RenderRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new RenderRequestRefusedError('The body is not JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null) throw new RenderRequestRefusedError('The body is not an object.');
  const { markup, generatedAt } = parsed as Record<string, unknown>;
  if (typeof markup !== 'string' || !markup.trimStart().toLowerCase().startsWith('<!doctype html>')) {
    throw new RenderRequestRefusedError('`markup` must be a whole HTML document.');
  }
  if (typeof generatedAt !== 'number' || !Number.isSafeInteger(generatedAt) || generatedAt <= 0) {
    throw new RenderRequestRefusedError('`generatedAt` must be an instant in epoch milliseconds.');
  }
  return { markup, generatedAt };
}
