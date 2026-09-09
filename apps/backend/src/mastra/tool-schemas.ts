import { z } from 'zod';

export const emptyInputSchema = z.object({}).strict();
export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').refine(value => {
    const date = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const accountAliasSchema = z.string().regex(/^accounts-[1-9]\d*$/, 'Choose a current account alias');
export const productAliasSchema = z.string().regex(/^products-[1-9]\d*$/, 'Choose a current product alias');
export const privateDisplayOutputSchema = (kind: 'accounts' | 'balance' | 'transactions' | 'cards' | 'products') => z.object({
    displayed: z.literal(true),
    resources: z.array(z.object({ alias: z.string().regex(new RegExp('^' + kind + '-[1-9]\\d*$')) }).strict()).max(100),
}).strict();
export const secureControlOutputSchema = z.object({
    displayed: z.literal(true),
    message: z.string().min(1).max(200),
}).strict();
