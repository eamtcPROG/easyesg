import { createHash } from 'node:crypto';
import type { ReportDocument } from '@api/contracts/report-document.port';
import type { TenantWork } from '@api/contracts/tenant-work.port';
import type { ExportArtifactStore } from '../interfaces/export-artifact-store.interface';
import type { RequestedExport } from '../models/requested-export.model';
import { ProducePdfExport, type ProducePdfExportCommand } from './produce-pdf-export.use-case';

const NOW = new Date('2026-10-11T09:30:00Z');
const PDF = Buffer.from('%PDF-1.7 the file');
const REQUESTED: RequestedExport = { id: 'export-1', reportId: 'report-1', locale: 'ru', requestedBy: 'Ana Rusu' };
const COMMAND: ProducePdfExportCommand = { organizationId: 'org-1', exportId: 'export-1', attempt: 1, attempts: 3 };

/** Everything the use case touches, recording what happened and whether it happened inside a unit of work. */
function harness(options: { requested?: RequestedExport | null; print?: () => Promise<Buffer> } = {}) {
  const events: string[] = [];
  let inside = false;
  const tenantWork: TenantWork = {
    inOrganization: async (scope, work) => {
      events.push(`enter ${scope.organizationId}`);
      inside = true;
      try {
        return await work();
      } finally {
        inside = false;
        events.push('leave');
      }
    },
  };
  const store: ExportArtifactStore & { completed: unknown[]; failed: unknown[] } = {
    completed: [],
    failed: [],
    findRequested: () => Promise.resolve(options.requested === undefined ? REQUESTED : options.requested),
    complete: (command) => {
      store.completed.push(command);
      return Promise.resolve();
    },
    fail: (command) => {
      store.failed.push(command);
      return Promise.resolve();
    },
  };
  const composed: unknown[] = [];
  const stored: unknown[] = [];
  const produce = new ProducePdfExport(
    tenantWork,
    store,
    {
      execute: (query) => {
        composed.push(query);
        return Promise.resolve({ locale: query.locale } as ReportDocument);
      },
    },
    { render: (document) => `<!doctype html><html lang="${document.locale}"></html>` },
    {
      print: (input) => {
        events.push(`print ${inside ? 'inside' : 'outside'} a unit of work at ${input.generatedAt.toISOString()}`);
        return options.print ? options.print() : Promise.resolve(PDF);
      },
    },
    {
      put: (input) => {
        stored.push(input);
        return Promise.resolve();
      },
    },
    () => NOW,
  );
  return { produce, store, composed, stored, events };
}

describe('ProducePdfExport (task 44.2; FR-49, FR-53, AD-10)', () => {
  it('composes the export’s document in its language with the file’s facts, prints it outside any unit of work, stores it under its export and settles the record', async () => {
    const { produce, store, composed, stored, events } = harness();
    await produce.execute(COMMAND);

    expect(composed).toEqual([
      { reportId: 'report-1', locale: 'ru', production: { generatedAt: NOW, generatedBy: 'Ana Rusu' } },
    ]);
    expect(events).toEqual([
      'enter org-1',
      'leave',
      'print outside a unit of work at 2026-10-11T09:30:00.000Z',
      'enter org-1',
      'leave',
    ]);
    expect(stored).toEqual([
      { key: 'organizations/org-1/exports/export-1.pdf', body: PDF, contentType: 'application/pdf' },
    ]);
    expect(store.completed).toEqual([
      {
        exportId: 'export-1',
        generatedAt: NOW,
        objectKey: 'organizations/org-1/exports/export-1.pdf',
        byteSize: PDF.length,
        sha256: createHash('sha256').update(PDF).digest('hex'),
      },
    ]);
  });

  it('does nothing for an export already settled — a re-emitted job is the same job (AD-6)', async () => {
    const { produce, store, stored, events } = harness({ requested: null });
    await produce.execute(COMMAND);
    expect(events).toEqual(['enter org-1', 'leave']);
    expect(stored).toEqual([]);
    expect(store.completed).toEqual([]);
  });

  it('throws a failed attempt for the queue to retry, and records nothing before the last', async () => {
    const { produce, store } = harness({ print: () => Promise.reject(new Error('The renderer answered 504: killed')) });
    await expect(produce.execute({ ...COMMAND, attempt: 2 })).rejects.toThrow('504');
    expect(store.failed).toEqual([]);
  });

  it('records the last attempt’s failure, and still throws it', async () => {
    const { produce, store } = harness({ print: () => Promise.reject(new Error('The renderer answered 504: killed')) });
    await expect(produce.execute({ ...COMMAND, attempt: 3 })).rejects.toThrow('504');
    expect(store.failed).toEqual([{ exportId: 'export-1', failure: 'The renderer answered 504: killed' }]);
    expect(store.completed).toEqual([]);
  });
});
