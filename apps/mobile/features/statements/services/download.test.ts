import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ request: vi.fn(), share: vi.fn(), available: vi.fn(), files: new Map<string, { uri: string; exists: boolean; delete: () => void }>() }));
vi.mock('../../../lib/api/client', () => ({ request: mocks.request }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo-sharing', () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
vi.mock('expo-file-system', () => {
  class Directory {
    uri = 'file:///private/cache/banking-statements'; exists = true;
    create() {} list() { return [...mocks.files.values()].filter(file => file.exists); }
  }
  class File {
    uri: string; exists = false;
    constructor(directory: Directory, id: string) { this.uri = directory.uri + '/' + id; mocks.files.set(this.uri, this); }
    write() { this.exists = true; }
    delete() { this.exists = false; }
  }
  return { File, Directory, Paths: { cache: 'file:///private/cache' } };
});
import { clearStatementFiles, downloadStatement } from './download';
beforeEach(() => {
  mocks.files.clear(); mocks.request.mockReset(); mocks.share.mockReset(); mocks.available.mockReset();
  mocks.available.mockResolvedValue(true);
  mocks.request.mockResolvedValue(new Response('%PDF-1.7 synthetic', { headers: { 'content-type': 'application/pdf' } }));
});
describe('statement exports', () => {
  it('uses ID-only authenticated requests and deletes its private temporary file on completion', async () => {
    await downloadStatement('secret', 'statement-1');
    expect(mocks.request).toHaveBeenCalledWith('/api/statements/statement-1/download', 'secret', { headers: { Accept: 'application/pdf' } });
    expect(mocks.share.mock.calls[0]?.[0]).toBe('file:///private/cache/banking-statements/statement-1.pdf');
    expect([...mocks.files.values()].every(file => !file.exists)).toBe(true);
  });
  it('retains the active explicit share across background cleanup until sharing finishes', async () => {
    let finish!: () => void;
    mocks.share.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    const download = downloadStatement('secret', 'statement-2');
    await vi.waitFor(() => expect(mocks.share).toHaveBeenCalled());
    clearStatementFiles(); expect([...mocks.files.values()][0]?.exists).toBe(true);
    finish(); await download; expect([...mocks.files.values()][0]?.exists).toBe(false);
  });
  it('never opens arbitrary URLs or a non-PDF response', async () => {
    await expect(downloadStatement('secret', 'https://evil.test/steal')).rejects.toThrow();
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.request.mockResolvedValue(new Response('not a PDF', { headers: { 'content-type': 'text/html' } }));
    await expect(downloadStatement('secret', 'statement-3')).rejects.toThrow();
    expect(mocks.share).not.toHaveBeenCalled();
  });
  it('cancels a pending export if the session locks before a response arrives', async () => {
    let finish!: (response: Response) => void;
    mocks.request.mockImplementation(() => new Promise<Response>(resolve => { finish = resolve; }));
    const operation = downloadStatement('secret', 'statement-4');
    const rejected = expect(operation).rejects.toThrow('Session changed');
    clearStatementFiles(); finish(new Response('%PDF-1.7', { headers: { 'content-type': 'application/pdf' } }));
    await rejected; expect(mocks.share).not.toHaveBeenCalled();
  });
});
