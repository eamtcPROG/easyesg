import { isExportFormat, isExportStatus, readResultObject, type Export } from '@easyesg/contracts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/**
 * One export, `GET /api/v1/exports/{id}` through the token-attaching pass-through (task 47.3; FR-49, UX-46) — what S-11
 * polls while the file is produced. The only path from the browser to the api (AD-9), so nothing here knows a token
 * exists.
 *
 * **It answers the export or `null`, never throws**: a poll that fails is not something the reader can act on — the
 * card keeps what it last knew and the poll backs off (`export-job-state.ts`). An answer this tier cannot read is the
 * same fact as no answer; the members the card branches on are checked, never cast.
 */
export const exportPath = (exportId: string): string => `/api/v1/exports/${encodeURIComponent(exportId)}`;

/**
 * The export's file through the same pass-through, which forwards its `content-disposition` so it saves under its own
 * name (FR-53) — the stored bytes, never regenerated. A link, never a fetch: the browser saves it.
 */
export const exportFileAddress = (exportId: string): string => `${exportPath(exportId)}/file`;

export async function readExport(input: { readonly exportId: string; readonly fetch?: typeof fetch }): Promise<Export | null> {
  const send = input.fetch ?? fetch;
  const path = exportPath(input.exportId);
  try {
    const response = await send(path, { headers: { accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) return null;
    const { object } = readResultObject<unknown>(await response.json(), path);
    return isRecord(object) &&
      object.id === input.exportId &&
      isExportStatus(object.status) &&
      isExportFormat(object.format)
      ? (object as unknown as Export)
      : null;
  } catch {
    return null;
  }
}
