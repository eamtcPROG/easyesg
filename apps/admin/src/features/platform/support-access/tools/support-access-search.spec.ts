import { describe, expect, it } from 'vitest';
import {
  firstLogPageOf,
  grantApiPath,
  logApiPath,
  logViewOf,
  readSupportAccessSearch,
  withEntry,
  withGrant,
  withLogPage,
  withLogPageSize,
  withModule,
  withReport,
  withoutRequestForm,
} from './support-access-search';

const ORGANIZATION = '0192a000-0000-7000-8000-000000000001';
const REQUEST = '0192a000-0000-7000-8000-000000000002';
const REPORT = '0192a000-0000-7000-8000-000000000003';
const ENTRY = '0192a000-0000-7000-8000-000000000004';

describe('A-07’s address (task 67.9)', () => {
  it('keeps what it understands and drops the rest, writing no default', () => {
    expect(readSupportAccessSearch({})).toEqual({});
    expect(
      readSupportAccessSearch({ organization: ORGANIZATION, page: '3', entry: 'not-an-id', module: 'B3' }),
    ).toEqual({ organization: ORGANIZATION, page: 3 });
    expect(readSupportAccessSearch({ page: '1' })).toEqual({});
  });

  it('drops a module without its report and a report without its grant', () => {
    expect(readSupportAccessSearch({ report: REPORT, module: 'B3' })).toEqual({});
    expect(readSupportAccessSearch({ request: REQUEST, module: 'B3' })).toEqual({ request: REQUEST });
    expect(readSupportAccessSearch({ request: REQUEST, report: REPORT, module: 'B3' })).toEqual({
      request: REQUEST,
      report: REPORT,
      module: 'B3',
    });
  });

  it('refuses a module that is not a letter and a number, since it becomes part of a path', () => {
    expect(readSupportAccessSearch({ request: REQUEST, report: REPORT, module: '../B3' })).toEqual({
      request: REQUEST,
      report: REPORT,
    });
  });

  it('holds one panel: a grant being read closes the request form', () => {
    expect(readSupportAccessSearch({ organization: ORGANIZATION, request: REQUEST })).toEqual({ request: REQUEST });
    expect(withGrant({ organization: ORGANIZATION, page: 2 }, REQUEST)).toEqual({ request: REQUEST, page: 2 });
  });

  it('closes what an opening replaces', () => {
    const reading = { request: REQUEST, report: REPORT, module: 'B3', page: 2 };
    expect(withReport(reading, null)).toEqual({ request: REQUEST, page: 2 });
    expect(withModule(reading, null)).toEqual({ request: REQUEST, report: REPORT, page: 2 });
    expect(withGrant(reading, null)).toEqual({ page: 2 });
    expect(withoutRequestForm({ organization: ORGANIZATION, page: 2 })).toEqual({ page: 2 });
  });

  it('keeps an offered page size and drops the default and anything else (task 170)', () => {
    expect(readSupportAccessSearch({ onpage: '100' })).toEqual({ onpage: 100 });
    expect(readSupportAccessSearch({ onpage: 50 })).toEqual({ onpage: 50 });
    expect(readSupportAccessSearch({ onpage: '25' })).toEqual({});
    expect(readSupportAccessSearch({ onpage: '-1' })).toEqual({});
    expect(readSupportAccessSearch({ onpage: '40' })).toEqual({});
  });

  it('resolves the log’s view, and its first page at the size the log shows', () => {
    expect(logViewOf({})).toEqual({ page: 1, pageSize: 25 });
    expect(logViewOf({ page: 3, onpage: 100 })).toEqual({ page: 3, pageSize: 100 });
    // What the in-progress and grant regions read: the same key as the log's own whenever it is on page 1.
    expect(firstLogPageOf({ page: 3, onpage: 100 })).toEqual({ page: 1, pageSize: 100 });
    expect(firstLogPageOf({})).toEqual(logViewOf({}));
  });

  it('closes the open entry when the log moves, since it is looked up on the page being shown', () => {
    const open = { request: REQUEST, entry: ENTRY, page: 2, onpage: 50 } as const;
    expect(withLogPage(open, 3)).toEqual({ request: REQUEST, page: 3, onpage: 50 });
    expect(withLogPage(open, 1)).toEqual({ request: REQUEST, onpage: 50 });
    expect(withLogPageSize(open, 100)).toEqual({ request: REQUEST, onpage: 100 });
    expect(withLogPageSize(open, 25)).toEqual({ request: REQUEST });
    expect(withEntry({ page: 2 }, ENTRY)).toEqual({ page: 2, entry: ENTRY });
    expect(withEntry(open, null)).toEqual({ request: REQUEST, page: 2, onpage: 50 });
  });

  it('names the api’s paths, escaping every segment it did not write', () => {
    expect(logApiPath({ page: 2, pageSize: 50 })).toBe('/admin/support-access?page=2&onpage=50');
    expect(logApiPath(logViewOf({}))).toBe('/admin/support-access?page=1&onpage=25');
    const scope = { organizationId: ORGANIZATION, requestId: REQUEST };
    expect(grantApiPath(scope)).toBe(
      `/admin/organizations/${ORGANIZATION}/support-access/${REQUEST}/reports`,
    );
    expect(grantApiPath({ ...scope, reportId: REPORT })).toBe(
      `/admin/organizations/${ORGANIZATION}/support-access/${REQUEST}/reports/${REPORT}/modules`,
    );
    expect(grantApiPath({ ...scope, reportId: REPORT, module: 'B3' })).toBe(
      `/admin/organizations/${ORGANIZATION}/support-access/${REQUEST}/reports/${REPORT}/modules/B3`,
    );
  });
});
