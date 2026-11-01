import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * `config/efrag`, as `apps/api` sees it — the working directory of every script, suite and image entrypoint, and the
 * seed loader's own convention (task 45.3). One spelling, read by the template registry and by the map's publication
 * check, so the two cannot look in different places.
 */
export const efragDirectory = (): string => resolve(process.cwd(), '../../config/efrag');

/**
 * A committed template's bytes, or `null` where the release holds no such file or holds a different one — the file a
 * map names, under its version's directory, and only if its SHA-256 is the one the map was read from (task 46.1).
 *
 * Synchronous, because a configuration kind's refusal is (`configuration-kind-rules.ts`); a publication reads one file
 * once. The name is a bare file name by the map's own reading, so it cannot point outside the version's directory.
 */
export function committedTemplate(input: {
  readonly directory: string;
  readonly templateVersion: string;
  readonly template: { readonly file: string; readonly sha256: string };
}): Uint8Array | null {
  try {
    const bytes = new Uint8Array(readFileSync(join(input.directory, input.templateVersion, input.template.file)));
    return createHash('sha256').update(bytes).digest('hex') === input.template.sha256 ? bytes : null;
  } catch {
    return null;
  }
}
