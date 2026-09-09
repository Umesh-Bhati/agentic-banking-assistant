import { afterEach, describe, expect, it, vi } from 'vitest';
import { reportStartupFailure } from '../../src/index.js';

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
});

describe('startup error reporting', () => {
    it('logs the underlying error during development', () => {
        vi.stubEnv('NODE_ENV', 'development');
        const error = new Error('configuration is invalid');
        const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        reportStartupFailure(error);

        expect(log).toHaveBeenCalledWith('Server startup failed', error);
    });

    it('does not expose error details in production', () => {
        vi.stubEnv('NODE_ENV', 'production');
        const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

        reportStartupFailure(new Error('sensitive provider response'));

        expect(write).toHaveBeenCalledWith('Server startup failed\n');
    });
});
