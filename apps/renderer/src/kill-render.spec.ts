import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { killRender, renderSwitch } from './kill-render.js';

describe('killRender', () => {
  let proc: string;

  const process = async (pid: number, argv: readonly string[]) => {
    await mkdir(join(proc, String(pid)));
    await writeFile(join(proc, String(pid), 'cmdline'), `${argv.join('\0')}\0`);
  };

  beforeEach(async () => {
    proc = await mkdtemp(join(tmpdir(), 'proc-'));
  });
  afterEach(() => rm(proc, { recursive: true, force: true }));

  it('kills the render’s browser and its whole process group by the switch its launch carried, and nothing else', async () => {
    await process(40, ['/ms-playwright/chrome', '--headless', renderSwitch('render-a')]);
    await process(41, ['/ms-playwright/chrome', '--headless', renderSwitch('render-b')]);
    await process(42, ['node', 'dist/main.js']);
    await mkdir(join(proc, 'self'));
    const signalled: [number, string][] = [];

    const killed = await killRender({ render: 'render-a', proc, kill: (pid, signal) => void signalled.push([pid, signal]) });

    expect(killed).toBe(1);
    expect(signalled).toEqual([
      [-40, 'SIGKILL'],
      [40, 'SIGKILL'],
    ]);
  });

  it('matches the whole switch, never a render whose id merely begins the same', async () => {
    await process(50, ['/ms-playwright/chrome', renderSwitch('render-ab')]);
    expect(await killRender({ render: 'render-a', proc, kill: () => undefined })).toBe(0);
  });

  it('goes on past a process already gone', async () => {
    await process(60, ['/ms-playwright/chrome', renderSwitch('render-c')]);
    const killed = await killRender({
      render: 'render-c',
      proc,
      kill: () => {
        throw Object.assign(new Error('kill ESRCH'), { code: 'ESRCH' });
      },
    });
    expect(killed).toBe(1);
  });
});
