import { readSupportChannel, supportChannelRefusal } from './support-channel';

describe('the support channel (FR-212; task 77)', () => {
  it('reads one email address, trimmed', () => {
    expect(readSupportChannel({ address: ' ajutor@easyesg.md ' })).toEqual({ address: 'ajutor@easyesg.md' });
    expect(supportChannelRefusal({ address: 'ajutor@easyesg.md' })).toBeNull();
  });

  it.each([[{ address: 'ajutor' }], [{ address: '' }], [{}], [null], [['ajutor@easyesg.md']]])(
    'refuses %j, which names no address',
    (payload) => {
      expect(readSupportChannel(payload)).toBeNull();
      expect(supportChannelRefusal(payload)).toBe('a support channel names one email address');
    },
  );
});
