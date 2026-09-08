import { API_ORIGIN, ApiError } from '../../../lib/api/client';
export class SseDecoder {
  private buffer = '';
  push(chunk: string): unknown[] {
    this.buffer += chunk;
    if (this.buffer.length > 262144) throw new Error('Chat event exceeded the size limit');
    const frames = this.buffer.split(/\r?\n\r?\n/);
    this.buffer = frames.pop() || '';
    return frames.flatMap(frame => {
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return [];
      return [JSON.parse(data) as unknown];
    });
  }
  finish() { if (this.buffer.trim()) throw new Error('The chat response was interrupted. Reload history before retrying.'); }
}
// One transport serves the assistant runtime. Mutations are never automatically retried.
export async function* streamChat(token: string, sessionId: string, message: string, signal: AbortSignal): AsyncGenerator<unknown> {
  const xhr = new XMLHttpRequest();
  const decoder = new SseDecoder();
  const queue: unknown[] = [];
  let wake: (() => void) | undefined;
  let finished = false;
  let error: Error | undefined;
  let offset = 0;
  let completed = false;
  const notify = () => { wake?.(); wake = undefined; };
  const fail = (reason: Error) => { error = reason; finished = true; notify(); };
  xhr.open('POST', `${API_ORIGIN}/api/chat`);
  xhr.timeout = 90000;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('Authorization', `Bearer ${token}`);
  xhr.setRequestHeader('X-Banking-Client-Version', '1');
  xhr.onprogress = () => {
    if (xhr.status < 200 || xhr.status >= 300) return;
    try {
      if (xhr.responseURL && new URL(xhr.responseURL).origin !== API_ORIGIN) throw new Error('Unexpected chat redirect');
      if (xhr.responseText.length > 1048576) throw new Error('Chat response exceeded the size limit');
      queue.push(...decoder.push(xhr.responseText.slice(offset)));
      offset = xhr.responseText.length;
      notify();
    } catch (reason) { fail(reason as Error); xhr.abort(); }
  };
  xhr.onload = () => {
    if (xhr.status < 200 || xhr.status >= 300) return fail(new ApiError(xhr.status, 'Chat request failed. Reload history before retrying.'));
    xhr.onprogress?.({} as ProgressEvent);
    try { decoder.finish(); } catch (reason) { fail(reason as Error); }
    finished = true; notify();
  };
  xhr.onerror = () => fail(new Error('Connection lost. Reload history before retrying.'));
  xhr.ontimeout = () => fail(new Error('Chat timed out. Reload history before retrying.'));
  xhr.onabort = () => fail(new Error('Chat cancelled. Banking actions retain their server status.'));
  const abort = () => xhr.abort();
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new Error('Chat cancelled');
    xhr.send(JSON.stringify({ message, sessionId }));
    while (!finished || queue.length) {
      if (!queue.length) { await new Promise<void>(resolve => { wake = resolve; }); continue; }
      const item = queue.shift() as { type?: string; version?: number; error?: string };
      if (item.version !== 1) throw new Error('Unsupported chat protocol');
      if (item.type === 'error') throw new Error('Chat could not finish. Reload history before retrying.');
      if (item.type === 'done') completed = true;
      yield item;
    }
    if (error) throw error;
    if (!completed) throw new Error('Chat interrupted before server completion. Reload history before retrying.');
  } finally { signal.removeEventListener('abort', abort); xhr.abort(); }
}
