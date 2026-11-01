import type { ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import type { BrowserServer } from 'playwright';
import { withDeadline } from './deadline.js';
import { finishPdf, type FinisherSetup } from './finish-pdf.js';
import { killRender } from './kill-render.js';
import { printPdf } from './print-pdf.js';
import type { RenderRequest } from './render-request.js';

/**
 * One render attempt, start to finish, under one deadline (§12.5.6's task-44 row (4): 60 s): Chromium prints, the
 * finisher makes the file conform, and whatever is still running when the deadline passes — the browser or the
 * finisher — is killed. `abort` is the same kill for a client that stopped waiting.
 */
export async function renderPdf(input: {
  readonly request: RenderRequest;
  readonly deadlineMs: number;
  readonly finisher: FinisherSetup;
  readonly abort: AbortSignal;
}): Promise<Buffer> {
  const render = randomUUID();
  let browser: BrowserServer | undefined;
  let finisher: ChildProcess | undefined;
  // The browser by its switch first — it may have hung before Playwright had a handle to it — then the handle, so
  // Playwright learns its browser is gone.
  const kill = async () => {
    finisher?.kill('SIGKILL');
    await killRender({ render });
    await browser?.kill();
  };
  const onAbort = () => void kill();
  input.abort.addEventListener('abort', onAbort, { once: true });
  try {
    return await withDeadline({
      ms: input.deadlineMs,
      expire: kill,
      work: async () => {
        const printed = await printPdf({ markup: input.request.markup, render, track: (server) => (browser = server) });
        return finishPdf({
          setup: input.finisher,
          pdf: printed.pdf,
          links: printed.links,
          generatedAt: input.request.generatedAt,
          track: (child) => (finisher = child),
        });
      },
    });
  } finally {
    input.abort.removeEventListener('abort', onAbort);
  }
}
