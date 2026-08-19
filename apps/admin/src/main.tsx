import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminProviders } from '~/app/providers';
import '~/app/styles/globals.css';

/**
 * Browser entry point. Mount only — no routing, no data, no session logic.
 *
 * There is no server tier behind this file and there must never be one: AD-9 rejected a
 * Next.js admin console, and AD-12 records the consequence that shapes `realm/` — a static SPA
 * cannot hold a token the way apps/web's proxy does.
 */
const container = document.getElementById('root');

if (!container) {
  // A developer-facing invariant, never rendered to anyone: index.html owns this element.
  throw new Error('Root container #root is missing from index.html');
}

createRoot(container).render(
  <StrictMode>
    <AdminProviders />
  </StrictMode>,
);
