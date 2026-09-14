import 'server-only';
import type { OrganizationSupportAccess } from '@easyesg/contracts';
import { API_OUTCOME } from '@/lib/api-outcome';
import { api } from '../api/api-client';

/**
 * Whether EasyESG support is asking to read the active organization's reports, or reading them now — the read
 * behind UX-124's banner across every signed-in screen (task 67.9; A-07's *organization's side*).
 *
 * **The API decides what each member is shown**: pending requests reach an Organization Administrator only, and
 * running access reaches every member. This tier passes the answer through and computes neither.
 *
 * **Every failure is `null`, and `null` draws nothing**, which is `readMemberships`' distinction for the band's
 * reason: a member of no organization (S-04) is refused with `membership-required`, S-35 is the screen where a
 * read has just failed, and a banner saying *we could not find out whether support is reading your data* would
 * be a claim this tier cannot stand behind. The cost is one render without a pending request, and the next
 * render asks again — a request waits 24 hours.
 */
export const readSupportAccess = async (): Promise<OrganizationSupportAccess | null> => {
  const outcome = await api.get<OrganizationSupportAccess>('/support-access');
  return outcome.status === API_OUTCOME.Ok ? outcome.value : null;
};
