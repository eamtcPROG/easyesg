import { fileURLToPath } from 'node:url';
import type { FinisherSetup } from './finish-pdf.js';

/** The renderer's settings, from its environment — each with the value the platform runs it at. */
export interface RendererConfig {
  readonly port: number;
  /** §12.5.6's task-44 row (4): a render attempt may run 60 s. */
  readonly deadlineMs: number;
  /** Renders at once; one, because Chromium's memory is the container's whole budget (T-13). */
  readonly slots: number;
  readonly finisher: FinisherSetup;
}

const positive = (name: string, value: string | undefined, fallback: number): number => {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive whole number.`);
  return parsed;
};

export function rendererConfig(env: NodeJS.ProcessEnv): RendererConfig {
  return {
    port: positive('RENDERER_PORT', env.RENDERER_PORT, 3000),
    deadlineMs: positive('RENDER_DEADLINE_MS', env.RENDER_DEADLINE_MS, 60_000),
    slots: positive('RENDER_SLOTS', env.RENDER_SLOTS, 1),
    finisher: {
      python: env.FINISHER_PYTHON ?? 'python3',
      script: env.FINISHER_SCRIPT ?? fileURLToPath(new URL('../finisher/finish_pdf.py', import.meta.url)),
      profile: env.FINISHER_PROFILE ?? '/usr/share/color/icc/sRGB.icc',
    },
  };
}
