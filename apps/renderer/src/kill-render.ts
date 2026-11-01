import { readdir, readFile } from 'node:fs/promises';

/** The switch that names one render's browser — Chromium ignores a switch it does not know, so it costs nothing. */
export const renderSwitch = (render: string): string => `--easyesg-render=${render}`;

/**
 * Kills one render's browser — every process whose command line carries the render's switch, with the whole process
 * group each leads (T-13; task 44.4).
 *
 * **Not through Playwright's handle, because a browser can hang before there is one.** A Chromium that stops while it is
 * still launching never answers with its endpoint, so `launchServer` neither resolves nor rejects — measured against a
 * launch given a 5 s timeout, still pending two minutes later — and a kill that waits for the handle reaches nothing,
 * leaving a stopped browser holding its memory for good. The switch is on the browser from its first instruction, and
 * Playwright launches it as the leader of its own process group, so `SIGKILL` to the group takes its children too.
 * `SIGKILL` reaches a stopped process, which no gentler signal does.
 *
 * Reads `/proc`, which is Linux's: the renderer runs in its container and nowhere else. `kill` is `process.kill` unless
 * a caller hands another.
 */
export async function killRender(input: {
  readonly render: string;
  readonly proc?: string;
  readonly kill?: (pid: number, signal: NodeJS.Signals) => void;
}): Promise<number> {
  const proc = input.proc ?? '/proc';
  const kill = input.kill ?? ((pid, signal) => process.kill(pid, signal));
  const marker = renderSwitch(input.render);
  let killed = 0;
  for (const pid of await readdir(proc)) {
    if (!/^\d+$/u.test(pid)) continue;
    let cmdline: string;
    try {
      cmdline = await readFile(`${proc}/${pid}/cmdline`, 'utf8');
    } catch {
      continue;
    }
    if (!cmdline.split('\0').includes(marker)) continue;
    for (const target of [-Number(pid), Number(pid)]) {
      try {
        kill(target, 'SIGKILL');
      } catch {
        // Gone already, or the group was the process itself — either way, nothing of it is left to kill.
      }
    }
    killed += 1;
  }
  return killed;
}
