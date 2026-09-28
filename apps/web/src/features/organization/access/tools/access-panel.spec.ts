import { describe, expect, it } from 'vitest';
import { ACCESS_PANEL, accessPanelHref, readAccessPanel } from './access-panel';

/**
 * The dialogue's address. The wire values are literals on purpose: a renamed parameter would break a
 * link someone has pasted, and this spec is what notices.
 */
describe('readAccessPanel', () => {
  it('reads the invitation form', () => {
    expect(readAccessPanel(new URLSearchParams('panel=invite'))).toBe('invite');
  });

  it('reads nothing when the address names no dialogue', () => {
    expect(readAccessPanel(new URLSearchParams('role=editor'))).toBeNull();
  });

  it('opens nothing for a value it does not know', () => {
    expect(readAccessPanel(new URLSearchParams('panel=remove'))).toBeNull();
  });
});

describe('accessPanelHref', () => {
  const pathname = '/en/organization/users';

  it('opens the dialogue over the list the reader was looking at', () => {
    expect(
      accessPanelHref({ pathname, search: '?role=editor&page=2', panel: ACCESS_PANEL.INVITE }),
    ).toBe('/en/organization/users?role=editor&page=2&panel=invite');
  });

  it('closes it back to that same list', () => {
    expect(
      accessPanelHref({ pathname, search: '?role=editor&panel=invite&page=2', panel: null }),
    ).toBe('/en/organization/users?role=editor&page=2');
  });

  /** No trailing `?`: a bare path and the default view stay one address, as `accessViewQuery` keeps them. */
  it('leaves the bare path when nothing else is in the address', () => {
    expect(accessPanelHref({ pathname, search: '?panel=invite', panel: null })).toBe(pathname);
  });

  it('does not add the parameter twice when it is already there', () => {
    expect(
      accessPanelHref({ pathname, search: '?panel=invite', panel: ACCESS_PANEL.INVITE }),
    ).toBe('/en/organization/users?panel=invite');
  });
});
