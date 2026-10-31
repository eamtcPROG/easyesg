import { cache } from 'react';
import type { SupportChannel } from '@easyesg/contracts';
import { api } from '@/server/api/api-client';

/**
 * Support's mailbox, read with no session (task 227; `GET /support/channel`; `architecture.md` §12.5.6's task-227 row
 * (4)) — what S-32 names to a visitor and S-34 says a request is sent to. `cache()`d per request, so a page reads it
 * once whoever asks.
 */
export const readSupportChannel = cache(() => api.get<SupportChannel>('/support/channel'));
