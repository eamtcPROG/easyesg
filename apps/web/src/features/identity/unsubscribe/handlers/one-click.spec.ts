import { beforeEach, describe, expect, it, vi } from 'vitest';

/** RFC 8058's target (task 52.2.2): the api's answer as a status, and the token forwarded as it came. */
const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('server-only', () => ({}));
vi.mock('@/server/api/api-client', () => ({ api: { post: mocks.post } }));

import { answerOneClick } from './one-click';

beforeEach(() => vi.clearAllMocks());

describe('answerOneClick', () => {
  it('forwards the token to the api’s switch and answers 200 once it is switched off', async () => {
    mocks.post.mockResolvedValue({ status: 'ok', value: { standing: 'switched_off' }, messages: [] });

    const answer = await answerOneClick('v1~abc~def');

    expect(mocks.post).toHaveBeenCalledWith('/account/notification-preferences/unsubscribe', { token: 'v1~abc~def' });
    expect(answer.status).toBe(200);
    expect(await answer.text()).toBe('');
  });

  it('answers the api’s own status where it refused the link', async () => {
    mocks.post.mockResolvedValue({ status: 'problem', problem: { type: 'x', status: 400 } });
    expect((await answerOneClick('forged')).status).toBe(400);
  });

  it('answers 503 where the api could not be reached, which a mail client may retry', async () => {
    mocks.post.mockResolvedValue({ status: 'unreachable' });
    expect((await answerOneClick('v1~abc~def')).status).toBe(503);
  });
});
