import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { DeadlineExceededError } from './deadline.js';
import { FinishRefusedError } from './finish-pdf.js';
import { renderPdf } from './render-pdf.js';
import { readRenderRequest, RenderRequestRefusedError } from './render-request.js';
import { renderSlots } from './render-slots.js';
import type { RendererConfig } from './renderer-config.js';

/** The service's two routes — its whole surface. */
const ROUTE = {
  HEALTH: { method: 'GET', path: '/health' },
  RENDER: { method: 'POST', path: '/render' },
} as const;

/** A document is a few hundred kilobytes with its fonts inside it; anything near this is not one. */
const BODY_LIMIT_BYTES = 16 * 1024 * 1024;

class BodyTooLargeError extends Error {}

/**
 * The renderer's HTTP surface — two routes, for its one client, the worker. `POST /render` answers the finished PDF, or
 * a status that says which failure it was: 400 for a body that is not a render request, 504 for a render killed at its
 * deadline (the hang T-13 names), 422 for a file the finisher could not make conform, 500 for anything else. A client
 * that stops waiting kills its render, so an abandoned attempt does not hold a slot while the retry waits for one.
 */
export function rendererServer(config: RendererConfig): Server {
  const slots = renderSlots(config.slots);

  const render = async (request: IncomingMessage, response: ServerResponse) => {
    const started = Date.now();
    const abandoned = new AbortController();
    response.once('close', () => {
      if (!response.writableFinished) abandoned.abort();
    });
    try {
      const body = await readBody(request);
      const renderRequest = readRenderRequest(body);
      const pdf = await slots.run(() =>
        renderPdf({ request: renderRequest, deadlineMs: config.deadlineMs, finisher: config.finisher, abort: abandoned.signal }),
      );
      response.writeHead(200, { 'content-type': 'application/pdf', 'content-length': pdf.length });
      response.end(pdf);
      log({ outcome: 'rendered', ms: Date.now() - started, bytes: pdf.length });
    } catch (error) {
      const status = statusOf(error);
      log({ outcome: 'refused', status, ms: Date.now() - started, reason: (error as Error).message });
      if (!response.headersSent) {
        response.writeHead(status, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status, detail: (error as Error).message }));
      }
    }
  };

  return createServer((request, response) => {
    if (request.method === ROUTE.HEALTH.method && request.url === ROUTE.HEALTH.path) {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.end('ok');
      return;
    }
    if (request.method === ROUTE.RENDER.method && request.url === ROUTE.RENDER.path) {
      void render(request, response);
      return;
    }
    response.writeHead(404).end();
  });
}

function statusOf(error: unknown): number {
  if (error instanceof RenderRequestRefusedError) return 400;
  if (error instanceof BodyTooLargeError) return 413;
  if (error instanceof DeadlineExceededError) return 504;
  if (error instanceof FinishRefusedError) return 422;
  return 500;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size > BODY_LIMIT_BYTES) throw new BodyTooLargeError(`The body exceeds ${BODY_LIMIT_BYTES} bytes.`);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/** One line per render, never its markup — the markup is a tenant's report. */
function log(entry: Record<string, unknown>): void {
  console.log(JSON.stringify({ time: new Date().toISOString(), event: 'render', ...entry }));
}
