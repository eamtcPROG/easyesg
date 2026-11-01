import { describe, expect, it, vi } from 'vitest';
import type { EventFrame } from '@easyesg/contracts';
import { FrameHub } from './frame-hub';

const frame = (event: EventFrame['event']): EventFrame => ({ event, organizationId: 'org-1', since: 1 });

describe('FrameHub', () => {
  it('hands a frame to the listeners of its event and no others', () => {
    const hub = new FrameHub();
    const access = vi.fn();
    const unread = vi.fn();
    hub.subscribe('access.changed', access);
    hub.subscribe('notification.unread_changed', unread);

    hub.publish(frame('access.changed'));

    expect(access).toHaveBeenCalledWith(frame('access.changed'));
    expect(unread).not.toHaveBeenCalled();
  });

  it('is demanded while anything listens, and says so as the count crosses zero', () => {
    const hub = new FrameHub();
    const reported: boolean[] = [];
    hub.onDemand(() => reported.push(hub.demanded));

    const leave = hub.subscribe('access.changed', vi.fn());
    expect(hub.demanded).toBe(true);
    leave();
    leave();

    expect(hub.demanded).toBe(false);
    expect(reported).toEqual([true, false]);
  });

  it('stops handing frames to a listener that left', () => {
    const hub = new FrameHub();
    const listener = vi.fn();
    hub.subscribe('access.changed', listener)();

    hub.publish(frame('access.changed'));

    expect(listener).not.toHaveBeenCalled();
  });
});
