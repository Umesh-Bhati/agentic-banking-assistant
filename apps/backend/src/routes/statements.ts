import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';

export async function createStatementRoute(
  fastify: FastifyInstance,
  config: { supabaseUrl: string; supabaseServiceKey: string }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);

  fastify.get('/api/statements', async (request: FastifyRequest<{ Querystring: { accountId: string, fromDate: string, toDate: string, token?: string, access_token?: string } }>, reply: FastifyReply) => {
    const { accountId, fromDate, toDate } = request.query;

    if (!accountId) {
      return reply.code(400).send({ error: 'Missing accountId' });
    }

    try {
      const { data: product, error: productError } = await supabase
        .from('customer_products')
        .select('*, customer_profiles(full_name)')
        .eq('id', accountId)
        .single();

      if (productError || !product) {
        return reply.code(404).send({ error: 'Account/Product not found' });
      }

      if (product.customer_id !== request.customerId) {
        return reply.code(403).send({ error: 'Unauthorized access to this statement' });
      }

      let transactions: any[] = [];
      if (product.linked_account_id) {
        let query = supabase
          .from('transactions')
          .select('*')
          .eq('account_id', product.linked_account_id)
          .order('created_at', { ascending: false });

        if (fromDate) query = query.gte('created_at', fromDate);
        if (toDate) query = query.lte('created_at', `${toDate}T23:59:59.999Z`);

        const { data: txs, error: txError } = await query;
        if (txError) {
          return reply.code(500).send({ error: 'Failed to fetch transactions' });
        }
        transactions = txs || [];
      }

      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      doc.fontSize(20).text('Al Masraf Bank Statement', { align: 'center' });
      doc.moveDown();
      
      const fullName = Array.isArray(product.customer_profiles) ? product.customer_profiles[0]?.full_name : product.customer_profiles?.full_name;
      doc.fontSize(12).text(`Customer Name: ${fullName || 'N/A'}`);
      doc.text(`Account/Card Number: ${product.product_number}`);
      doc.text(`Product Type: ${product.product_name}`);
      doc.text(`Currency: ${product.currency}`);
      doc.text(`Period: ${fromDate || 'Beginning of time'} to ${toDate || 'Present'}`);
      doc.moveDown();

      doc.fontSize(14).text('Transactions', { underline: true });
      doc.moveDown();

      if (!transactions || transactions.length === 0) {
        doc.fontSize(12).text('No transactions found for this period.');
      } else {
        transactions.forEach(tx => {
          const date = new Date(tx.created_at).toLocaleDateString();
          const amount = Number(tx.amount).toFixed(2);
          const sign = tx.type === 'CREDIT' ? '+' : '';
          doc.fontSize(10).text(`${date} | ${tx.description} | ${sign}${amount} ${tx.currency}`);
        });
      }

      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      doc.end();
      const pdfBuffer = await pdfPromise;

      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="statement-${product.product_number.replace(/\s+/g, '')}.pdf"`);
      
      return reply.send(pdfBuffer);
    } catch (err) {
      console.error('Statement PDF error:', err);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}
