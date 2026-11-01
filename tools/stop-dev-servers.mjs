/**
 * Stops this repository's dev servers before the browser suite starts (task 102; `architecture.md`
 * §12.5.6's task-102 row). `pree2e:web` runs it first, before the builds.
 *
 * ## Why
 *
 * The suite serves its stack on the ports the dev servers use — `e2e/stack.ts` says why: the console's
 * api address is inlined at build time, and the suite should test the build that ships rather than a
 * second one configured for other ports. Until task 102 Playwright then *adopted* whatever already
 * answered those ports and said so only under `DEBUG=pw:webserver`, so a local run could be green
 * against a `next dev` carrying none of the suite's environment, or against a server an interrupted
 * run had left behind. Three such runs are on record. Stopping the servers first, with
 * `reuseExistingServer: false` behind it, means every server the suite talks to is one it started.
 *
 * ## What it stops: the whole job, as Ctrl+C would
 *
 * Measured on the three real dev servers, each started as a terminal job: stopping only the process
 * on the port ended `next dev` and `vite` with it, and left `nest start --watch` running — ready to
 * start the api again on the next edit, in the middle of a suite run. So the unit is the listening
 * process's **process group**, which for a terminal job is the `pnpm` command and everything under it.
 *
 * ## What it never touches
 *
 * - **A process not running from this repository**, judged by its working directory. 3000 is a
 *   common default and the port may belong to another project; the run fails and names it instead.
 *   The working directory rather than the command line, because `next dev`'s server renames itself
 *   `next-server (v16.3.0)` and its command line then names no path.
 * - **Its own process group** — a dev server started in the same job as this run shares it, and
 *   signalling it would stop the run. That case fails too.
 * - **Anything, before every listener has been judged.** A foreign process on one port stops the run
 *   without stopping the dev servers on the others, so nothing is half done.
 *
 * Skipped when `CI` is set: a runner starts with nothing listening, and ending processes on a shared
 * machine is not this script's business.
 */
import { execFileSync } from 'node:child_process';
import { resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { STACK_PORT } from '../e2e/stack.ts';

const PREFIX = 'stop-dev-servers:';
const POLL_MS = 250;
const POLLS = 40;

if (process.env.CI) {
  console.log(`${PREFIX} CI — nothing to stop`);
  process.exit(0);
}

const root = resolve(import.meta.dirname, '..');
const ports = Object.values(STACK_PORT);

/** A command's output; `lsof` exits 1 when nothing matches, which is an answer, not a failure. */
function output(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`${PREFIX} \`${command}\` is not installed, so the suite's ports cannot be checked.`);
      process.exit(1);
    }
    return typeof error.stdout === 'string' ? error.stdout : '';
  }
}

const listenersOn = (port) =>
  output('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split('\n')
    .filter(Boolean)
    .map(Number);

const workingDirectoryOf = (pid) =>
  output('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'])
    .split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1) ?? null;

const fieldOf = (pid, field) => output('ps', ['-o', `${field}=`, '-p', String(pid)]).trim();

/**
 * A process group id, or `null` when the process has already gone. **The guard is the point**: `ps`
 * answers nothing for a vanished process, `Number('')` is `0`, and signalling group `-0` signals the
 * caller's own group — this run.
 */
function groupOf(pid) {
  const group = Number(fieldOf(pid, 'pgid'));
  return Number.isInteger(group) && group > 1 ? group : null;
}

const insideRepository = (path) => path === root || path.startsWith(root + sep);
const heldPorts = () => ports.filter((port) => listenersOn(port).length > 0);

const ownGroup = groupOf(process.pid);
const toStop = new Map();
const refused = [];

for (const port of ports) {
  for (const pid of listenersOn(port)) {
    const group = groupOf(pid);
    if (group === null) continue;
    const command = fieldOf(pid, 'command');
    const directory = workingDirectoryOf(pid);
    if (directory === null || !insideRepository(directory)) {
      refused.push(`port ${port} is held by pid ${pid}, which is not running from this repository: ${command}`);
    } else if (group === ownGroup) {
      refused.push(`port ${port} is held by pid ${pid}, started in the same job as this run: ${command}`);
    } else {
      toStop.set(group, `port ${port} — ${command}`);
    }
  }
}

if (refused.length > 0) {
  for (const reason of refused) console.error(`${PREFIX} ${reason}`);
  console.error(`${PREFIX} stop it yourself and run again; nothing was stopped.`);
  process.exit(1);
}

async function signalAndWait(signal) {
  for (const group of toStop.keys()) {
    try {
      process.kill(-group, signal);
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  for (let poll = 0; poll < POLLS && heldPorts().length > 0; poll += 1) await sleep(POLL_MS);
  return heldPorts();
}

if (toStop.size === 0) {
  console.log(`${PREFIX} nothing listening on ${ports.join(', ')}`);
  process.exit(0);
}

for (const what of toStop.values()) console.log(`${PREFIX} stopping ${what}`);
let stillHeld = await signalAndWait('SIGTERM');
if (stillHeld.length > 0) stillHeld = await signalAndWait('SIGKILL');
if (stillHeld.length > 0) {
  console.error(`${PREFIX} ports ${stillHeld.join(', ')} are still held after SIGKILL.`);
  process.exit(1);
}
console.log(`${PREFIX} ${ports.join(', ')} are free; start the dev servers again when the suite is done.`);
