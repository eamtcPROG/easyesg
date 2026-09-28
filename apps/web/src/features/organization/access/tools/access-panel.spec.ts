import { describe, expect, it } from 'vitest';
import { ACCESS_PANEL, accessPanelHref, readAccessPanel, readRemindPerson } from './access-panel';

/**
 * The dialogues' address. The wire values are literals on purpose: a renamed parameter would break a
 * link someone has pasted, and this spec is what notices.
 */
describe('readAccessPanel', () => {
  it('reads the invitation form', () => {
    expect(readAccessPanel(new URLSearchParams('panel=invite'))).toBe('invite');
  });

  it('reads the reminder form', () => {
    expect(readAccessPanel(new URLSearchParams('panel=remind'))).toBe('remind');
  });

  it('reads nothing when the address names no dialogue', () => {
    expect(readAccessPanel(new URLSearchParams('role=editor'))).toBeNull();
  });

  it('opens nothing for a value it does not know', () => {
    expect(readAccessPanel(new URLSearchParams('panel=remove'))).toBeNull();
  });
});

describe('readRemindPerson', () => {
  it('reads whom the reminder opens with', () => {
    expect(readRemindPerson(new URLSearchParams('panel=remind&person=m-1'))).toBe('m-1');
  });

  /** A `person` beside another dialogue, or none, chooses nobody. */
  it('reads nobody unless the reminder is the dialogue open', () => {
    expect(readRemindPerson(new URLSearchParams('panel=invite&person=m-1'))).toBeNull();
    expect(readRemindPerson(new URLSearchParams('person=m-1'))).toBeNull();
  });

  it('reads nobody from an empty value', () => {
    expect(readRemindPerson(new URLSearchParams('panel=remind&person='))).toBeNull();
  });
});

describe('accessPanelHref', () => {
  const pathname = '/en/organization/users';

  it('opens a dialogue over the list the reader was looking at', () => {
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

  it('carries the person a reminder opens with', () => {
    expect(
      accessPanelHref({ pathname, search: '', panel: ACCESS_PANEL.REMIND, person: 'm-1' }),
    ).toBe('/en/organization/users?panel=remind&person=m-1');
  });

  /** The person is the reminder's: closing it, or opening the invitation instead, takes them out. */
  it('takes the person out with the reminder', () => {
    const search = '?panel=remind&person=m-1';
    expect(accessPanelHref({ pathname, search, panel: null })).toBe(pathname);
    expect(accessPanelHref({ pathname, search, panel: ACCESS_PANEL.INVITE })).toBe(
      '/en/organization/users?panel=invite',
    );
  });
});
