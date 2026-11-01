/**
 * The report's document printed to PDF (task 44; FR-49, AD-10, T-13) — behind a port, because what prints it is a
 * service of its own (§5's `renderer`: headless Chromium and the in-place finishing step), reached over the network
 * from the worker and never from the request tier.
 *
 * **It takes markup, not the document's model**: `REPORT_DOCUMENT_RENDERER` makes the markup the preview frames, and
 * the PDF is that same markup printed, so the preview and the file are one function's output (FR-48 behaviour 2).
 */
export interface PdfRenderer {
  /**
   * A tagged PDF/A-2a and PDF/UA-1 file of the markup (NFR-82), its metadata dated `generatedAt` — or a throw, whose
   * message says why for the job's record: the render hung and was killed, the file could not be made to conform, or
   * the renderer could not be reached. Every failure is one a retry on a fresh browser may not repeat (T-13).
   */
  print(input: { readonly markup: string; readonly generatedAt: Date }): Promise<Buffer>;
}

export const PDF_RENDERER = Symbol('PDF_RENDERER');
