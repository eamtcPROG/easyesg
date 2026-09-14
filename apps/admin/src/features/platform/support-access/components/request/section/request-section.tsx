import { useState } from 'react';
import { withoutRequestForm, type SupportAccessSearch } from '../../../tools/support-access-search';
import { RequestChoose } from '../states/request-choose';
import { RequestOrganization } from './request-organization';
import { RequestSent } from '../states/request-sent';

/**
 * A-07's request region (task 67.9; UC-85) — the Focus half of the screen. **Which arm is the address's**: a
 * request form for the organization A-02 opened it for, the notice that one was just sent, or, where nothing else
 * is open, the way to choose an organization.
 *
 * **The sent notice is this region's state, not the address's**: a request once sent is on the log, which is the
 * lasting record; the notice is the moment after, and it closes when dismissed or when another form opens.
 */
export function RequestSection({
  search,
  onSearchChange,
}: {
  readonly search: SupportAccessSearch;
  readonly onSearchChange: (next: SupportAccessSearch) => void;
}) {
  const [sentTo, setSentTo] = useState<string | null>(null);

  if (search.organization !== undefined) {
    return (
      <RequestOrganization
        organizationId={search.organization}
        onSent={(organizationName) => {
          setSentTo(organizationName);
          onSearchChange(withoutRequestForm(search));
        }}
        onCancel={() => onSearchChange(withoutRequestForm(search))}
      />
    );
  }
  if (sentTo !== null) return <RequestSent organization={sentTo} onDismiss={() => setSentTo(null)} />;
  // A grant being read is its own panel; a prompt to choose an organization beside it would be noise.
  return search.request === undefined ? <RequestChoose /> : null;
}
