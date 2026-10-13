import type { LegalControllerResponse } from '@easyesg/contracts';
import { api } from '@/server/api/api-client';

/**
 * The platform operator the legal documents name (task 75; FR-205; `architecture.md` §12.5.6's task-75 row (7)) — the
 * api's public read, which a reader with no session reaches as one with a session does.
 */
export const readLegalController = () => api.get<LegalControllerResponse>('/legal/controller');
