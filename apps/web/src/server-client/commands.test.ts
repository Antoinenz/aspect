import { describe, it, expect, vi, beforeEach } from 'vitest';

const sent: unknown[] = [];
vi.mock('./socket.js', () => ({
  sendToServer: (msg: unknown) => {
    sent.push(msg);
    return true;
  },
}));

import { callService } from './commands.js';

describe('callService', () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it('sends a call_service message with data', () => {
    callService('light', 'turn_on', 'light.k', { brightness_pct: 50 });
    expect(sent[0]).toEqual({
      type: 'call_service',
      domain: 'light',
      service: 'turn_on',
      entityId: 'light.k',
      data: { brightness_pct: 50 },
    });
  });
});
