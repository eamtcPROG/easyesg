import { spawn, type ChildProcess } from 'node:child_process';

/** Where the finisher and the colour profile it embeds are, and what runs it. */
export interface FinisherSetup {
  readonly python: string;
  readonly script: string;
  /** The sRGB ICC profile the output intent carries — Debian's `icc-profiles-free`, installed by the image. */
  readonly profile: string;
}

/** The finisher refused the file — a structure it could not make conform, said in its own words. */
export class FinishRefusedError extends Error {}

/** `finish_pdf.py`'s exit status for a refusal; any other failure is the finisher's own, and a defect. */
const REFUSED = 2;

/**
 * Hands Chromium's file to `finisher/finish_pdf.py`, which makes it PDF/A-2a and PDF/UA-1 in place — the step AD-10
 * gives qpdf and pikepdf, because Chromium's tagging is real but leaves the output intent, the identification
 * metadata, list bodies, link descriptions and the marking of decoration and page furniture undone. The bytes go in on
 * stdin and come back on stdout; `track` lets a deadline kill the process.
 */
export async function finishPdf(input: {
  readonly setup: FinisherSetup;
  readonly pdf: Buffer;
  readonly links: readonly string[];
  readonly generatedAt: number;
  readonly track: (child: ChildProcess) => void;
}): Promise<Buffer> {
  const child = spawn(
    input.setup.python,
    [
      input.setup.script,
      '--generated-at',
      new Date(input.generatedAt).toISOString(),
      '--profile',
      input.setup.profile,
      '--links',
      JSON.stringify(input.links),
    ],
    { stdio: ['pipe', 'pipe', 'pipe'] },
  );
  input.track(child);
  const out: Buffer[] = [];
  const err: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
  child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
  const exited = new Promise<number | null>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', resolve);
  });
  child.stdin.end(input.pdf);
  const code = await exited;
  if (code === 0) return Buffer.concat(out);
  const said = Buffer.concat(err).toString('utf8').trim();
  if (code === REFUSED) throw new FinishRefusedError(said);
  throw new Error(`The finisher failed (exit ${code}): ${said}`);
}
