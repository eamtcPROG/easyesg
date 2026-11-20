import { queryOptions } from '@tanstack/react-query';
import type { PublishRulesRequest, PublishedRules, RuleFamily, RulesConsole } from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';

/**
 * A-05's read and its publication (task 67.8), through the realm's one client. **No poll** (UX-116): a publication
 * invalidates the read, and is judged against the revision the operator read.
 */
export const RULES_CONSOLE_QUERY_KEY = ['admin', 'rules'] as const;

export const rulesConsoleQuery = () =>
  queryOptions({ queryKey: RULES_CONSOLE_QUERY_KEY, queryFn: () => api.get<RulesConsole>('/admin/rules') });

export const publishRules = (input: { readonly family: RuleFamily; readonly scope: string } & PublishRulesRequest) =>
  api.put<PublishRulesRequest, PublishedRules>(
    `/admin/rules/${encodeURIComponent(input.family)}/${encodeURIComponent(input.scope)}`,
    {
      payload: input.payload,
      validFrom: input.validFrom ?? null,
      validTo: input.validTo ?? null,
      expectedRevision: input.expectedRevision,
    },
  );
