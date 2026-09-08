import { FastifyInstance } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { ActionRepository } from '../repositories/action.repository.js';
import { ActionState } from '@boit/shared-types';
import { clientOptions } from '../lib/shared-supabase.js';
export function validatePeriod(fromDate: string, toDate: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(toDate || ''))
        throw new Error('Date range required');
    const start = Date.parse(fromDate), end = Date.parse(toDate);
    if (!Number.isFinite(start) || !Number.isFinite(end) || new Date(start).toISOString().slice(0, 10) !== fromDate || new Date(end).toISOString().slice(0, 10) !== toDate || end < start || end - start > 366 * 86400000 || end > Date.now())
        throw new Error('Invalid date range');
}
export async function quoteStatement(db: SupabaseClient, userId: string, customerId: string, productId: string, fromDate: string, toDate: string, idempotencyKey: string) {
    if (process.env.BANKING_MUTATIONS_ENABLED !== 'true')
        throw new Error('Banking mutations are disabled');
    validatePeriod(fromDate, toDate);
    if (!productId || !idempotencyKey || idempotencyKey.length > 100)
        throw new Error('Product and idempotency key required');
    const { data, error } = await db.rpc('quote_statement', { p_user_id: userId, p_customer_id: customerId, p_product_id: productId, p_start_date: fromDate, p_end_date: toDate, p_idempotency_key: idempotencyKey });
    if (error || !data)
        throw new Error('Statement quote unavailable; choose a supported account product');
    return statementView(db, customerId, Array.isArray(data) ? data[0] : data);
}
export async function statementView(db: SupabaseClient, customerId: string, row: any) {
    const { data: account, error } = await db.from('bank_accounts').select('account_number').eq('id', row.account_id).eq('customer_id', customerId).single();
    if (error || !account)
        throw new Error('Debit account unavailable');
    return { ...publicStatement(row), debitAccountLabel: 'Account ••••' + String(account.account_number).slice(-4) };
}
export function publicStatement(row: any) {
    return { statementId: row.id, id: row.id, actionId: row.action_id, productId: row.product_id, accountId: row.account_id, fromDate: row.from_date, toDate: row.to_date, fee: String(row.fee), currency: row.currency, status: row.status };
}
export async function createStatementRoute(fastify: FastifyInstance, config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
}) {
    const admin = createClient(config.supabaseUrl, config.supabaseServiceKey, clientOptions);
    fastify.get('/api/statements', async (_request, reply) => reply.code(410).send({ error: 'A confirmed statement ID is required' }));
    fastify.post<{
        Body: {
            productId: string;
            fromDate: string;
            toDate: string;
            idempotencyKey: string;
        };
    }>('/api/statements/requests', async (request) => {
        const b = request.body || {};
        return { statement: await quoteStatement(admin, request.userId, request.customerId, b.productId, b.fromDate, b.toDate, b.idempotencyKey) };
    });
    fastify.post<{
        Params: {
            id: string;
        };
    }>('/api/statements/:id/confirm', async (request) => {
        const { data: row, error } = await request.database.from('statement_requests').select('*').eq('id', request.params.id).eq('customer_id', request.customerId).single();
        if (error || !row)
            throw new Error('Statement not found');
        const repo = new ActionRepository(admin);
        const existing = await repo.getById(row.action_id);
        if (!existing || existing.customerId !== request.customerId)
            throw new Error('Statement action not found');
        const action = existing.status === ActionState.PENDING_AUTHORIZATION ? existing : await repo.updateStatus(existing.id, ActionState.PENDING_AUTHORIZATION, undefined, existing);
        return { statement: await statementView(request.database, request.customerId, row), action };
    });
    fastify.get<{
        Params: {
            id: string;
        };
    }>('/api/statements/:id/download', async (request, reply) => {
        const { data: statement, error } = await request.database.from('statement_requests').select('*').eq('id', request.params.id).eq('customer_id', request.customerId).single();
        if (error || !statement || statement.status !== 'ISSUED')
            return reply.code(404).send({ error: 'Issued statement not found' });
        const txs = statement.transactions_snapshot;
        if (!Array.isArray(txs) || txs.length > 10000)
            throw new Error('Statement exceeds generation limits');
        const doc = new PDFDocument({ margin: 50 });
        const chunks: Buffer[] = [];
        let bytes = 0;
        const pdf = new Promise<Buffer>((resolve, reject) => {
            doc.on('data', (chunk: Buffer) => {
                bytes += chunk.length;
                if (bytes > 10 * 1024 * 1024) {
                    doc.destroy(new Error('PDF limit exceeded'));
                    return;
                }
                chunks.push(chunk);
            });
            doc.on('error', reject);
            doc.on('end', () => resolve(Buffer.concat(chunks)));
        });
        doc.fontSize(20).text('Bank account statement');
        doc.fontSize(12).text('Period: ' + statement.from_date + ' to ' + statement.to_date);
        for (const tx of txs)
            doc.fontSize(10).text(String(tx.created_at).slice(0, 10) + ' | ' + String(tx.description).slice(0, 200) + ' | ' + String(tx.amount) + ' ' + String(tx.currency));
        doc.end();
        reply.header('Content-Type', 'application/pdf').header('Cache-Control', 'private, no-store').header('Content-Disposition', 'attachment; filename="statement.pdf"');
        return reply.send(await pdf);
    });
}
