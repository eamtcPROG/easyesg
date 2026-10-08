import type { Finding } from '@easyesg/validation';
import { findingsInScope } from './findings-in-scope';

const on = (elementKey: string, related: string[] = []): Finding => ({
  rule: `rule-${elementKey}`,
  verdict: 'missing',
  field: { elementKey, dimensionKey: '', ordinal: 0 },
  related: related.map((key) => ({ elementKey: key, dimensionKey: '', ordinal: 0 })),
  message: 'validation.required',
  params: {},
});

/** 182/26 (task 41.2; FR-43 AC-8): a finding whose field has left the report's scope since the run is not shown. */
describe('findingsInScope', () => {
  const scope = new Map<string, readonly string[]>([['Turnover', ['B1']]]);

  it('keeps a finding whose field is in scope, and drops one whose field has left it', () => {
    expect(findingsInScope({ findings: [on('Turnover'), on('Assets')], scope })).toEqual([on('Turnover')]);
  });

  it('judges by the field it sits on, not the fields it relates to', () => {
    expect(findingsInScope({ findings: [on('Turnover', ['Assets'])], scope })).toEqual([on('Turnover', ['Assets'])]);
  });
});
