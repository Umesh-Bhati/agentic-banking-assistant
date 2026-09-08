import { createClient, SupabaseClient } from '@supabase/supabase-js';
const boundedFetch: typeof fetch = (input, init) => {
    const signal = AbortSignal.any([AbortSignal.timeout(10000), ...(init?.signal ? [init.signal] : [])]);
    return fetch(input, {...init, signal});
};
export const clientOptions = { global: { fetch: boundedFetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
export function getSharedSupabaseClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;
    if (!url || !key)
        throw new Error('Database configuration is required');
    return createClient(url, key, clientOptions);
}
export function userClient(url: string, key: string, token: string): SupabaseClient {
    return createClient(url, key, { ...clientOptions, global: { ...clientOptions.global, headers: { Authorization: `Bearer ${token}` } } });
}
