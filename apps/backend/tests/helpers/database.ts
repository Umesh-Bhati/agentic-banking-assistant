import { vi } from 'vitest';
export function query(result: {
    data: unknown;
    error: unknown;
}) {
    const builder: any = {};
    for (const method of ['select', 'eq', 'insert', 'upsert', 'update', 'delete', 'order', 'limit', 'gte', 'lte', 'textSearch'])
        builder[method] = vi.fn(() => builder);
    builder.single = vi.fn(async () => result);
    builder.maybeSingle = vi.fn(async () => result);
    builder.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
    return builder;
}
export const principal = { authUserId: '11111111-1111-4111-8111-111111111111', customerId: '22222222-2222-4222-8222-222222222222', sessionId: '33333333-3333-4333-8333-333333333333', expiresAt: 2000000000 };
