import { queryOptions } from '@tanstack/react-query';
import type {
  AdoptTaxonomyVersionRequest,
  LabelDiff,
  MappedField,
  PublishedTaxonomy,
  PublishVersionMappingRequest,
  RegisterTaxonomyVersionRequest,
  TaxonomyCompatibility,
  TaxonomyConsole,
  TaxonomyExposure,
  VersionMapping,
} from '@easyesg/contracts';
import type { Locale } from '@easyesg/i18n';
import { api } from '~/realm/api/api-client';

/**
 * A-04's reads and writes for versions, mappings, adoption, exposure and EFRAG's label diff (tasks 67.21, 67.22, 67.6),
 * through the realm's one client. **No poll** (UX-116): a write invalidates the scope, and every write is judged against
 * the revision the operator read. **The exposure read is a logged acquisition**, so it is read when its region opens,
 * never on a timer.
 */
export const TAXONOMY_QUERY_SCOPE = ['admin', 'taxonomy'] as const;

export const taxonomyConsoleQuery = () =>
  queryOptions({ queryKey: [...TAXONOMY_QUERY_SCOPE, 'console'], queryFn: () => api.get<TaxonomyConsole>('/admin/taxonomy') });

export const taxonomyExposureQuery = () =>
  queryOptions({
    queryKey: [...TAXONOMY_QUERY_SCOPE, 'exposure'],
    queryFn: () => api.get<TaxonomyExposure>('/admin/taxonomy/exposure'),
  });

const pairPath = (pair: { readonly from: string; readonly to: string }) =>
  `${encodeURIComponent(pair.from)}/${encodeURIComponent(pair.to)}`;

export const mappingProposalQuery = (pair: { readonly from: string; readonly to: string }) =>
  queryOptions({
    queryKey: [...TAXONOMY_QUERY_SCOPE, 'proposal', pair.from, pair.to],
    queryFn: () => api.get<VersionMapping>(`/admin/taxonomy/mappings/${pairPath(pair)}/proposal`),
  });

export const labelDiffQuery = (input: { readonly from: string; readonly to: string; readonly locale: Locale }) =>
  queryOptions({
    queryKey: [...TAXONOMY_QUERY_SCOPE, 'label-diff', input.from, input.to, input.locale],
    queryFn: () => api.get<LabelDiff>(`/admin/taxonomy/label-diff/${pairPath(input)}?locale=${encodeURIComponent(input.locale)}`),
  });

export const registerTaxonomyVersion = (version: string) =>
  api.post<RegisterTaxonomyVersionRequest, PublishedTaxonomy>('/admin/taxonomy/versions', { version });

export const publishVersionMapping = (input: {
  readonly from: string;
  readonly to: string;
  readonly determination: TaxonomyCompatibility;
  readonly fields: readonly MappedField[];
  readonly expectedRevision: number;
}) =>
  api.put<PublishVersionMappingRequest, PublishedTaxonomy>(`/admin/taxonomy/mappings/${pairPath(input)}`, {
    determination: input.determination,
    fields: input.fields.map((field) => ({ ...field })),
    expectedRevision: input.expectedRevision,
  });

export const adoptTaxonomyVersion = (input: AdoptTaxonomyVersionRequest) =>
  api.post<AdoptTaxonomyVersionRequest, PublishedTaxonomy>('/admin/taxonomy/adoption', input);
