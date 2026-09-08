import { SupabaseClient } from '@supabase/supabase-js';
import type { Principal } from '../../plugins/auth.plugin.js';
export interface PrivateContext {
    principal: Principal;
    database: SupabaseClient;
    signal?: AbortSignal;
    aliases: Map<string, string>;
    emit: (event: unknown) => Promise<void>;
}
export function toolContext(requestContext: any): PrivateContext {
    const context = requestContext?.get('privateContext') as PrivateContext;
    if (!context?.principal?.customerId || !context.database || !context.emit || context.signal?.aborted)
        throw new Error('Authenticated tool context required');
    return context;
}
export function resolveAlias(context: PrivateContext, alias?: string) {
    if (!alias)
        return undefined;
    const id = context.aliases.get(alias);
    if (!id)
        throw new Error('Choose an available resource');
    return id;
}
export async function privateResult(context: PrivateContext, kind: string, items: any[]) {
    await context.emit({ type: 'PRIVATE_DATA', data: { kind, items } });
    return { displayed: true, resources: items.map((item, index) => {
            const alias = kind + '-' + (index + 1);
            if (item.id)
                context.aliases.set(alias, item.id);
            return { alias };
        }) };
}
