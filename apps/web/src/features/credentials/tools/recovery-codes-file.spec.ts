import { describe, expect, it } from 'vitest';
import { recoveryCodesFile } from './recovery-codes-file';

describe('recoveryCodesFile', () => {
  it('puts the heading and what the codes are for above one code a line, in CRLF', () => {
    expect(
      recoveryCodesFile({ heading: 'EasyESG — recovery codes', note: 'Each works once.', codes: ['AAAA-BBBB', 'CCCC-DDDD'] }),
    ).toBe('EasyESG — recovery codes\r\nEach works once.\r\n\r\nAAAA-BBBB\r\nCCCC-DDDD\r\n');
  });
});
