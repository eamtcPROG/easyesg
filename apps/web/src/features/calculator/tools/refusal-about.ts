/**
 * What a refused request asked for (tasks 39.2, 39.3) — a run, or one of UC-34's acts on a B3 figure — which decides the
 * screen's words for an answer that never arrived; a refusal the api composed is shown as received either way.
 * **Its own module, not the client component that reads it**: a vocabulary declared in a `'use client'` module is a
 * client reference to any Server Component that imports it (the root `CLAUDE.md`).
 */
export const REFUSAL_ABOUT = { RUN: 'run', FIGURE: 'figure' } as const;

export type RefusalAbout = (typeof REFUSAL_ABOUT)[keyof typeof REFUSAL_ABOUT];
