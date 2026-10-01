import { addDecimals, multiplyDecimals, sumDecimals } from './decimal-arithmetic';

describe('exact decimal arithmetic', () => {
  it('multiplies without binary noise', () => {
    // As floats: 500 * 0.0095773 = 4.7886500000000005.
    expect(multiplyDecimals('500', '0.0095773')).toBe('4.78865');
    expect(multiplyDecimals('4.78865', '0.202544')).toBe('0.9699123256');
  });

  it('adds without binary noise', () => {
    // As floats: 0.1 + 0.2 = 0.30000000000000004.
    expect(addDecimals('0.1', '0.2')).toBe('0.3');
    expect(addDecimals('1.5', '2')).toBe('3.5');
  });

  it('answers the canonical form: no trailing zeros, and zero as `0`', () => {
    expect(multiplyDecimals('2.50', '4')).toBe('10');
    expect(multiplyDecimals('0', '0.594645')).toBe('0');
    expect(addDecimals('0.000', '0')).toBe('0');
    expect(multiplyDecimals('0.001', '0.001')).toBe('0.000001');
  });

  it('sums any number of decimals, and none as zero', () => {
    expect(sumDecimals(['0.95', '0.84', '0.000001'])).toBe('1.790001');
    expect(sumDecimals([])).toBe('0');
  });

  it('refuses a value that is not a decimal string, rather than computing with it', () => {
    expect(() => multiplyDecimals('1e3', '2')).toThrow(RangeError);
    expect(() => addDecimals('-1', '2')).toThrow(RangeError);
  });
});
