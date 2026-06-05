import { describe, it, expect } from 'vitest';
import {
  createStatusMessage,
  isServerToClientMessage,
  type StatusMessage,
} from './messages.js';

describe('createStatusMessage', () => {
  it('builds a status message with a timestamp', () => {
    const before = Date.now();
    const msg = createStatusMessage('online', true);
    expect(msg.type).toBe('status');
    expect(msg.status).toBe('online');
    expect(msg.haConnected).toBe(true);
    expect(msg.ts).toBeGreaterThanOrEqual(before);
  });
});

describe('isServerToClientMessage', () => {
  it('accepts a valid status message', () => {
    const msg: StatusMessage = createStatusMessage('degraded', false);
    expect(isServerToClientMessage(msg)).toBe(true);
  });

  it('rejects malformed input', () => {
    expect(isServerToClientMessage({ type: 'nope' })).toBe(false);
    expect(isServerToClientMessage(null)).toBe(false);
    expect(isServerToClientMessage('status')).toBe(false);
  });
});
