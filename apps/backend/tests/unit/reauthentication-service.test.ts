import { describe, it, expect, vi } from 'vitest';
import { verifyEnrollmentPassword } from '../../src/services/actions/reauthentication.service.js';
import { principal } from '../helpers/database.js';

function fixture(options: { wrongPassword?: boolean; wrongIdentity?: boolean; cleanupFailure?: boolean } = {}) {
    const user = { id: principal.authUserId, email: 'verified@example.com' };
    const proofUser = options.wrongIdentity ? { ...user, id: 'other-user' } : user;
    const getUser = vi.fn(async () => ({ data: { user }, error: null }));
    const signInWithPassword = vi.fn(async () => options.wrongPassword
        ? { data: { user: null, session: null }, error: { message: 'Wrong password' } }
        : { data: { user: proofUser, session: { user: proofUser, access_token: 'temporary', refresh_token: 'temporary-refresh' } }, error: null });
    const signOut = vi.fn(async () => ({ error: options.cleanupFailure ? { message: 'Outage' } : null }));
    const proofFactory = vi.fn(() => ({ auth: { signInWithPassword, signOut } } as any));
    const authenticate = (password: unknown) => verifyEnrollmentPassword(principal, 'original-token', password, { auth: { getUser } } as any, proofFactory);
    return { authenticate, getUser, signInWithPassword, signOut, proofFactory };
}

describe('Fresh credentials before MFA enrollment', () => {
    it('rejects missing password before creating any proof session', async () => {
        const f = fixture();
        await expect(f.authenticate(undefined)).rejects.toThrow('Current password');
        expect(f.proofFactory).not.toHaveBeenCalled();
    });
    it('rejects incorrect password without changing the original session', async () => {
        const f = fixture({ wrongPassword: true });
        await expect(f.authenticate('wrong')).rejects.toThrow('Password verification failed');
        expect(f.getUser).toHaveBeenCalledWith('original-token');
        expect(f.signOut).not.toHaveBeenCalled();
    });
    it('uses authoritative email and revokes only the isolated proof session', async () => {
        const f = fixture();
        await expect(f.authenticate(' valid password ')).resolves.toBeUndefined();
        expect(f.signInWithPassword).toHaveBeenCalledWith({ email: 'verified@example.com', password: ' valid password ' });
        expect(f.signOut).toHaveBeenCalledWith({ scope: 'local' });
        expect(f.proofFactory).toHaveBeenCalledTimes(1);
    });
    it('rejects a different returned user and still revokes that proof session', async () => {
        const f = fixture({ wrongIdentity: true });
        await expect(f.authenticate('password')).rejects.toThrow('Password verification failed');
        expect(f.signOut).toHaveBeenCalledWith({ scope: 'local' });
    });
    it('fails closed if proof-session revocation fails', async () => {
        const f = fixture({ cleanupFailure: true });
        await expect(f.authenticate('password')).rejects.toThrow('Unable to close');
    });
});
