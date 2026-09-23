import { SocketRegistry } from './socket-registry';

/** The per-replica connection cap (task 147). */
describe('SocketRegistry (task 147)', () => {
  const socket = (name: string) => ({ name, close: jest.fn() });

  it('holds an account’s sockets up to the cap, and names the oldest once one more arrives', () => {
    const registry = new SocketRegistry<ReturnType<typeof socket>>(2);
    const [first, second, third] = [socket('first'), socket('second'), socket('third')];

    expect(registry.add({ accountId: 'ana', socket: first })).toEqual([]);
    expect(registry.add({ accountId: 'ana', socket: second })).toEqual([]);
    expect(registry.add({ accountId: 'ana', socket: third })).toEqual([first]);
    expect(registry.countFor('ana')).toBe(2);
    expect(registry.all()).toEqual([second, third]);
    // The registry names; the caller closes, with the code it chooses.
    expect(first.close).not.toHaveBeenCalled();
  });

  it('counts each account apart', () => {
    const registry = new SocketRegistry<ReturnType<typeof socket>>(1);
    registry.add({ accountId: 'ana', socket: socket('a') });

    expect(registry.add({ accountId: 'ion', socket: socket('b') })).toEqual([]);
    expect(registry.all()).toHaveLength(2);
  });

  it('forgets a closed socket, and an account with none left', () => {
    const registry = new SocketRegistry<ReturnType<typeof socket>>(10);
    const only = socket('only');
    registry.add({ accountId: 'ana', socket: only });
    registry.remove({ accountId: 'ana', socket: only });

    expect(registry.countFor('ana')).toBe(0);
    expect(registry.all()).toEqual([]);
  });
});
