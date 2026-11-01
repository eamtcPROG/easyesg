import { queryOptions } from '@tanstack/react-query';
import type {
  ApiOutcome,
  LegalControllerPublication,
  LegalControllerRecord,
  PublishLegalControllerRequest,
} from '@easyesg/contracts';
import { api } from '~/realm/api/api-client';

/**
 * A-21's read and its one write (task 75), through the realm's one client. The outcome is the answer, not a thrown
 * error — A-02's reason: a 403 is a state the section draws. **No poll** (UX-116): the save invalidates the key, and a
 * save against values a colleague has since changed is refused by the api whatever this cache holds.
 */
export const LEGAL_CONTROLLER_QUERY_KEY = ['admin', 'legal-controller'] as const;

export const legalControllerQuery = () =>
  queryOptions({
    queryKey: LEGAL_CONTROLLER_QUERY_KEY,
    queryFn: () => api.get<LegalControllerRecord>('/admin/legal-controller'),
  });

/** The save — a configuration publication the api records in the system audit log. */
export const publishLegalController = (
  request: PublishLegalControllerRequest,
): Promise<ApiOutcome<LegalControllerPublication>> =>
  api.post<PublishLegalControllerRequest, LegalControllerPublication>('/admin/legal-controller/publication', request);
