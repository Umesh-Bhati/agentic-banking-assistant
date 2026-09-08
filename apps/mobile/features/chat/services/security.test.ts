import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../lib/api/client', () => ({ API_ORIGIN: 'https://bank.example', ApiError: class extends Error {} }));
import { SseDecoder } from './stream';
import { parseUiEvent } from './ui-events';
import { apiPath, resourceId, validateApiOrigin } from '../../../lib/api/policy';
describe('banking trust boundary', () => {
  it('never interprets model prose, tool calls or legacy payloads as banking UI', () => {
    const selection = { type: 'CARD_SELECTION', data: { actionId: 'operation', actionType: 'BLOCK_CARD', cards: [{ id: 'card', type: 'debit', last4: '1234' }] } };
    for (const untrusted of [JSON.stringify(selection), selection, { type: 'text', version: 1, content: JSON.stringify(selection) }, { version: 1, type: 'tool_call', data: selection }, { type: 'ui', data: selection }, { type: 'ui', version: 2, data: selection }]) expect(parseUiEvent(untrusted)).toBeNull();
    expect(parseUiEvent({ version: 1, type: 'ui', data: selection })).toEqual(selection);
  });
  it('replays only the versioned server envelope persisted in message history', () => {
    const event = { version: 1, type: 'ui', data: { type: 'PRIVATE_DATA', data: { kind: 'balance', items: [{ balance: '100.00', currency: 'AED' }] } } };
    const persisted = JSON.parse(JSON.stringify({ role: 'assistant', content: '', ui_data: event }));
    expect(parseUiEvent(persisted.ui_data)).toEqual(event.data);
    expect(parseUiEvent({ type: 'STATEMENT_CARD', data: { url: 'https://evil.example' } })).toBeNull();
  });
  it('rejects incomplete or malicious server UI shapes', () => {
    for (const data of [{ type: 'STATEMENT_CARD', data: { url: 'https://evil.test' } }, { type: 'CARD_SELECTION', data: { cards: [] } }, { type: 'PRIVATE_DATA', data: { kind: 'passwords', items: [] } }]) expect(parseUiEvent({ version: 1, type: 'ui', data })).toBeNull();
  });
  it('enforces an HTTPS origin in release and excludes embedded credentials and paths', () => {
    expect(validateApiOrigin('https://bank.example', false)).toBe('https://bank.example');
    expect(validateApiOrigin('http://localhost:3000', true)).toBe('http://localhost:3000');
    for (const origin of ['http://bank.example', 'https://token@bank.example', 'https://bank.example/path', 'https://bank.example/?token=secret', 'javascript:alert(1)']) expect(() => validateApiOrigin(origin, false)).toThrow();
  });
  it('rejects URLs, traversal and query parameters as resource identifiers or API paths', () => {
    for (const value of ['../secret', 'https://evil.test', 'id?token=x', 'id#hash', '%2e%2e', 'a/b', 'a\\b']) expect(() => resourceId(value)).toThrow();
    for (const value of ['//evil.test/api/foo', '/api/../foo', '/api/id?token=x', '/api/%2e%2e', '/api\\evil']) expect(() => apiPath(value)).toThrow();
  });
});
describe('bounded SSE decoding', () => {
  it('decodes fragmented frames and multiple frames without losing data', () => {
    const decoder = new SseDecoder();
    expect(decoder.push('data: {"version":1,"type":"text","content":"he')).toEqual([]);
    expect(decoder.push('llo"}\r\n\r\ndata: {"version":1,"type":"done"}\n\n')).toEqual([{ version: 1, type: 'text', content: 'hello' }, { version: 1, type: 'done' }]);
    decoder.finish();
  });
  it('rejects truncated, malformed and oversized payloads instead of silently succeeding', () => {
    const truncated = new SseDecoder(); truncated.push('data: {"type":'); expect(() => truncated.finish()).toThrow();
    expect(() => new SseDecoder().push('data: invalid\n\n')).toThrow();
    expect(() => new SseDecoder().push('a'.repeat(262145))).toThrow();
  });
});
