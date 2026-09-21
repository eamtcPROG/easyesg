import { dispatchChannels } from './dispatch-channels';

/**
 * The owner's rule for a notice whose category's behaviour cannot be read (task 49.3). Literals on purpose:
 * these are the channels an operator publishes.
 */
describe('dispatchChannels (task 49.3)', () => {
  const behaviour = { channels: ['in_app', 'email'], classification: 'optional' } as const;

  it.each([true, false])('obeys a readable behaviour, mandatory or not (%s)', (mandatory) => {
    expect(dispatchChannels({ behaviour, mandatory })).toEqual(['in_app', 'email']);
  });

  it('sends a mandatory category whose behaviour is unreadable by email, the floor', () => {
    expect(dispatchChannels({ behaviour: null, mandatory: true })).toEqual(['email']);
  });

  it('sends an optional category whose behaviour is unreadable on nothing', () => {
    expect(dispatchChannels({ behaviour: null, mandatory: false })).toBeNull();
  });
});
