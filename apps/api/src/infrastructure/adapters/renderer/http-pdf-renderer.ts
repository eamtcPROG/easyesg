import type { PdfRenderer } from '@api/contracts/pdf-renderer.port';

/**
 * `PdfRenderer` over the renderer service's one route (`apps/renderer`, `POST /render`). The renderer owns the render's
 * deadline and kills its own browser at it (§12.5.6's task-44 row (4)); this adapter's timeout is the backstop for a
 * renderer that stopped answering at all, and closing the connection is what tells the renderer to kill a render this
 * side gave up on.
 */
export class HttpPdfRenderer implements PdfRenderer {
  constructor(private readonly options: { readonly url: string; readonly timeoutMs: number }) {}

  async print(input: { readonly markup: string; readonly generatedAt: Date }): Promise<Buffer> {
    const response = await fetch(new URL('/render', this.options.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The renderer's wire carries the instant as epoch milliseconds, as every wire here does.
      body: JSON.stringify({ markup: input.markup, generatedAt: input.generatedAt.getTime() }),
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    if (!response.ok) {
      throw new Error(`The renderer answered ${response.status}: ${(await response.text()).slice(0, 500)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
}
