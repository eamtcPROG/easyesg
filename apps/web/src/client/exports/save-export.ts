import { exportFileAddress } from './read-export';

/**
 * An export's file saved as its link would save it (task 216; FR-53's behaviour 8) — **a link, never a fetch**: an
 * anchor carrying `download`, pointed at the session pass-through, which forwards the file's own name and bytes, and
 * pressed once. For a control that is not itself a link — S-06's row ⋯ since 19 Oct 2026 — so the browser still saves
 * the stored file rather than this tier reading it.
 */
export function saveExport(exportId: string): void {
  const link = document.createElement('a');
  link.href = exportFileAddress(exportId);
  link.download = '';
  link.click();
}
