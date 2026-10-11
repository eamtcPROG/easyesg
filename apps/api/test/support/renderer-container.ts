import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** The test stack's renderer — `infra/compose/docker-compose.test.yml`'s `container_name`. */
const CONTAINER = 'easyesg-test-renderer';

/**
 * The renderer's live Chromium processes: every one runs an executable under Playwright's browser directory. Matched on
 * the executable, never the command line — this script's own command line names that directory, and a script that
 * matched itself would stop itself.
 */
const BROWSER_PROCESSES = `
const fs = require('fs');
const browsers = () => fs.readdirSync('/proc').filter((pid) => /^\\d+$/.test(pid)).filter((pid) => {
  try {
    const live = !/^State:\\s+Z/m.test(fs.readFileSync('/proc/' + pid + '/status', 'utf8'));
    return live && fs.readlinkSync('/proc/' + pid + '/exe').startsWith('/ms-playwright/');
  } catch { return false; }
});
`;

/**
 * Hangs the next render the test stack's renderer starts — T-13's known failure, made on purpose (task 44.4).
 *
 * **From outside the renderer, on the real browser**: a script run in the container stops every Chromium process with
 * `SIGSTOP` the moment it appears, and keeps stopping its children for three seconds more. Nothing in the shipped
 * renderer knows a test is running, and what hangs is Chromium itself, not a stand-in for it. `SIGKILL` still reaches a
 * stopped process, which is what lets the renderer's deadline kill it.
 *
 * Resolves once the script is watching, so the render the caller starts next is the one it catches; `frozen` resolves
 * with how many processes it stopped.
 */
export async function freezeNextBrowser(): Promise<{ readonly frozen: Promise<number> }> {
  const script = `${BROWSER_PROCESSES}
const frozen = new Set();
let first = null;
const giveUp = Date.now() + 60000;
console.log('watching');
const tick = () => {
  for (const pid of browsers()) {
    if (frozen.has(pid)) continue;
    try { process.kill(Number(pid), 'SIGSTOP'); frozen.add(pid); first = first ?? Date.now(); } catch {}
  }
  if (Date.now() > giveUp || (first !== null && Date.now() - first > 3000)) {
    console.log('frozen ' + frozen.size);
    process.exit(0);
  }
  setTimeout(tick, 5);
};
tick();`;
  const child = spawn('docker', ['exec', CONTAINER, 'node', '-e', script], { stdio: ['ignore', 'pipe', 'inherit'] });
  let output = '';
  const frozen = new Promise<number>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', () => {
      const match = /frozen (\d+)/u.exec(output);
      if (match) resolve(Number(match[1]));
      else reject(new Error(`The freezer ended without freezing: ${output}`));
    });
  });
  await new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf8');
      if (output.includes('watching')) resolve();
    });
  });
  return { frozen };
}

/** How many Chromium processes are alive in the renderer — none between renders, and none after a killed one. */
export async function liveBrowserProcesses(): Promise<number> {
  const { stdout } = await run('docker', ['exec', CONTAINER, 'node', '-e', `${BROWSER_PROCESSES}\nconsole.log(browsers().length);`]);
  return Number(stdout.trim());
}
