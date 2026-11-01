import { execFile } from 'node:child_process';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const REPOSITORY = resolve(__dirname, '../../../..');

/** The test stack's Compose invocation, with the two env files `pnpm test:up` reads. */
const compose = (args: readonly string[]) =>
  run(
    'docker',
    [
      'compose',
      '-f',
      join(REPOSITORY, 'infra/compose/docker-compose.test.yml'),
      '--env-file',
      join(REPOSITORY, 'infra/compose/.env'),
      '--env-file',
      join(REPOSITORY, 'apps/api/.env.test'),
      ...args,
    ],
    { maxBuffer: 64 * 1024 * 1024 },
  );

/**
 * A file written where a container can mount it, and removed afterwards.
 *
 * **Readable by every user**, because veraPDF's image runs as its own `verapdf` user: in the `0700` directory `mkdtemp`
 * makes, it reports the file as absent and prints no report at all. Docker Desktop's file sharing hides ownership, so
 * only a Linux host — CI's runner — ever saw it, as `Unexpected end of JSON input`.
 */
async function withFile<T>(pdf: Buffer, work: (directory: string) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(join(tmpdir(), 'easyesg-pdf-'));
  try {
    await chmod(directory, 0o755);
    await writeFile(join(directory, 'document.pdf'), pdf, { mode: 0o644 });
    return await work(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/** What a PDF's reader sees, page by page — PDF.js reading the file, in a child process (`pdf-text.mjs`). */
export async function pdfText(pdf: Buffer): Promise<{ readonly pages: string[]; readonly title: string | null }> {
  return withFile(pdf, async (directory) => {
    const { stdout } = await run(process.execPath, [join(__dirname, 'pdf-text.mjs'), join(directory, 'document.pdf')], {
      maxBuffer: 64 * 1024 * 1024,
    });
    return JSON.parse(stdout) as { pages: string[]; title: string | null };
  });
}

/** Words compared with every space removed — PDF.js spaces letter-spaced labels and punctuation apart. */
export const squash = (text: string): string => text.replace(/\s+/gu, '');

/** One veraPDF verdict: compliant or not, and the rules a file fails by clause and test. */
export interface Conformance {
  readonly compliant: boolean;
  readonly failed: readonly string[];
}

/** veraPDF's verdict on a file against one profile — `2a` (PDF/A-2a) or `ua1` (PDF/UA-1) — through the test stack. */
export async function conformance(pdf: Buffer, flavour: '2a' | 'ua1'): Promise<Conformance> {
  return withFile(pdf, async (directory) => {
    const { stdout } = await compose([
      'run',
      '--rm',
      '-v',
      `${directory}:/data:ro`,
      'verapdf',
      '-f',
      flavour,
      '--format',
      'json',
      '/data/document.pdf',
    ]).catch((error: { stdout?: string }) => ({ stdout: error.stdout ?? '' }));
    const report = JSON.parse(stdout) as {
      report: { jobs: { validationResult: VeraResult | VeraResult[] }[] };
    };
    const result = report.report.jobs[0].validationResult;
    const verdict = Array.isArray(result) ? result[0] : result;
    return {
      compliant: verdict.compliant,
      failed: verdict.details.ruleSummaries.map((rule) => `${rule.clause}-${rule.testNumber}: ${rule.description}`),
    };
  });
}

interface VeraResult {
  compliant: boolean;
  details: { ruleSummaries: { clause: string; testNumber: number; description: string }[] };
}
