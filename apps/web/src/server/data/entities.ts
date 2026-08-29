import 'server-only';
import type { CountryLegalForms, NaceCodeMatch, ReportingEntity } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { toEntityRows, type EntityRow } from '@/features/entities/entities';
import { api } from '../api-client';
import { TENANT_READ, isPermissionRefusal } from './tenant-read';

/**
 * S-13's reads (task 30.4.2) — the list, and the words its codes stand for.
 *
 * `organization-access.ts`'s split again: this file knows the routes and what their failures mean.
 *
 * **The activity labels are one request for the whole page, not one per code.** `GET /entities`
 * answers bare keys, and a key on a screen is an internal identifier — so the distinct codes across
 * every row are resolved together through `?codes=`, which matches exactly and answers in the order
 * given. Searching per code would be N requests *and* wrong: `?q=` matches by prefix, so `10.7`
 * would answer three rows where one was asked for.
 */
export type EntityListRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly rows: readonly EntityRow[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

/** Resolves a set of codes to words, tolerating a failure by answering none of them. */
const resolveActivity = async (
  codes: readonly string[],
): Promise<ReadonlyMap<string, string>> => {
  if (codes.length === 0) return new Map();
  const outcome = await api.getList<NaceCodeMatch>(
    `/entities/nace-codes?codes=${encodeURIComponent(codes.join(','))}`,
  );
  // **A vocabulary failure must not fail the list.** The entities are the screen; their activity is
  // a label on it. An unreadable classifier leaves the words absent, which the row renders as the
  // codes it still holds — degraded and honest, rather than an error page over data that arrived.
  if (outcome.status !== API_OUTCOME.Ok) return new Map();
  return new Map(outcome.value.items.map((match) => [match.code, match.label]));
};

export async function readEntityList(): Promise<EntityListRead> {
  const entities = await api.getList<ReportingEntity>('/entities');

  if (isPermissionRefusal(entities)) return { status: TENANT_READ.FORBIDDEN };
  if (entities.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  // Distinct, because several entities in one organization routinely share a trade.
  const codes = [...new Set(entities.value.items.flatMap((entity) => entity.naceCodes))];
  const activity = await resolveActivity(codes);

  return { status: TENANT_READ.READY, rows: toEntityRows({ entities: entities.value.items, activity }) };
}

export type EntityRecordRead =
  | {
      readonly status: typeof TENANT_READ.READY;
      readonly entity: ReportingEntity;
      /** The words for the codes this entity already holds, so the picker opens showing them. */
      readonly activity: readonly NaceCodeMatch[];
      /** The organization's country vocabulary, for the legal-form select. */
      readonly countries: readonly CountryLegalForms[];
    }
  | { readonly status: typeof TENANT_READ.FORBIDDEN }
  | { readonly status: typeof TENANT_READ.UNREACHABLE };

export async function readEntityRecord(entityId: string): Promise<EntityRecordRead> {
  const [entity, vocabulary] = await Promise.all([
    api.get<ReportingEntity>(`/entities/${entityId}`),
    api.getList<CountryLegalForms>('/organizations/legal-forms'),
  ]);

  if (isPermissionRefusal(entity)) return { status: TENANT_READ.FORBIDDEN };
  if (entity.status !== API_OUTCOME.Ok) return { status: TENANT_READ.UNREACHABLE };

  // Sequential after the entity, and a data dependency rather than a waterfall to fix: the codes
  // to resolve are the ones this entity holds, which is what the first read answers.
  const activity = await resolveActivity(entity.value.naceCodes);

  return {
    status: TENANT_READ.READY,
    entity: entity.value,
    activity: entity.value.naceCodes.flatMap((code) => {
      const label = activity.get(code);
      return label === undefined ? [] : [{ code, label }];
    }),
    countries: vocabulary.status === API_OUTCOME.Ok ? vocabulary.value.items : [],
  };
}
