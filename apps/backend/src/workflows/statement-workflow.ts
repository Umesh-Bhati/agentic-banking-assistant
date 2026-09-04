import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';

export interface StatementWorkflowConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

const statementWorkflowStateSchema = z.object({
  userId: z.string().optional(),
  supabaseUrl: z.string().optional(),
  supabaseKey: z.string().optional(),
  accountId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  accepted: z.boolean().optional(),
});

// Step 1: Extract/validate statement parameters
const extractParamsStep = createStep({
  id: 'extract-statement-params',
  description: 'Extract and set date range for statement generation',
  inputSchema: statementWorkflowStateSchema,
  outputSchema: statementWorkflowStateSchema,
  execute: async ({ inputData }) => {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const fromDate = inputData.fromDate || thirtyDaysAgo.toISOString().split('T')[0];
    const toDate = inputData.toDate || today.toISOString().split('T')[0];

    return {
      ...inputData,
      fromDate,
      toDate,
    };
  },
});

// Step 2: Ask for fee acceptance (25 AED)
const askFeeAcceptanceStep = createStep({
  id: 'ask-fee-acceptance',
  description: 'Ask user to accept statement generation fee of 25 AED',
  inputSchema: statementWorkflowStateSchema,
  outputSchema: statementWorkflowStateSchema,
  suspendSchema: z.object({
    reason: z.string(),
    fee: z.number(),
    currency: z.string(),
  }),
  resumeSchema: z.object({
    accepted: z.boolean(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { accepted } = resumeData ?? {};

    if (accepted === undefined) {
      return await suspend({
        reason: 'Generating this statement will cost 25 AED. Do you accept?',
        fee: 25,
        currency: 'AED',
      });
    }

    if (!accepted) {
      throw new Error('Statement generation cancelled: fee declined by user.');
    }

    return { ...inputData, accepted: true };
  },
});

// Step 3: Deduct fee and generate statement payload
const deductFeeAndGenerateStep = createStep({
  id: 'deduct-fee-and-generate',
  description: 'Deduct fee from account and output statement card payload',
  inputSchema: statementWorkflowStateSchema,
  outputSchema: z.object({
    success: z.boolean(),
    type: z.string(),
    data: z.object({
      url: z.string(),
      fee: z.number(),
      currency: z.string(),
      accountNumber: z.string().optional(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
    }),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(inputData.supabaseUrl!, inputData.supabaseKey!);

    // Fetch user account
    const { data: account, error: accountError } = await supabase
      .from('bank_accounts')
      .select('id, account_number, balance, currency')
      .eq('customer_id', inputData.userId!)
      .single();

    if (accountError || !account) {
      throw new Error('Bank account not found');
    }

    const feeAmount = 25.00;

    // Deduct fee: insert transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert({
        account_id: account.id,
        amount: -feeAmount,
        currency: account.currency || 'AED',
        type: 'DEBIT',
        category: 'FEE',
        description: 'Account Statement Generation Fee',
        created_at: new Date().toISOString(),
      });

    if (txError) {
      throw new Error(`Failed to record fee transaction: ${txError.message}`);
    }

    // Update account balance
    const newBalance = (account.balance || 0) - feeAmount;
    await supabase
      .from('bank_accounts')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', account.id);

    return {
      success: true,
      type: 'STATEMENT_CARD',
      data: {
        url: 'https://almasraf.ae/statements/statement-2026.pdf',
        fee: feeAmount,
        currency: account.currency || 'AED',
        accountNumber: account.account_number,
        fromDate: inputData.fromDate,
        toDate: inputData.toDate,
      },
      message: 'Your account statement has been generated successfully.',
    };
  },
});

export const createStatementWorkflow = (config: StatementWorkflowConfig) => {
  return createWorkflow({
    id: 'statement-workflow',
    description: 'Workflow to request account statements with fee deduction',
    inputSchema: z.object({
      userId: z.string(),
      supabaseUrl: z.string(),
      supabaseKey: z.string(),
      fromDate: z.string().optional(),
      toDate: z.string().optional(),
      accountId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      type: z.string(),
      data: z.object({
        url: z.string(),
        fee: z.number(),
        currency: z.string(),
        accountNumber: z.string().optional(),
        fromDate: z.string().optional(),
        toDate: z.string().optional(),
      }),
      message: z.string(),
    }),
  })
    .then(extractParamsStep)
    .then(askFeeAcceptanceStep)
    .then(deductFeeAndGenerateStep)
    .commit();
};

export type StatementWorkflowInput = {
  userId: string;
  supabaseUrl: string;
  supabaseKey: string;
  fromDate?: string;
  toDate?: string;
  accountId?: string;
};

export type StatementWorkflowOutput = {
  success: boolean;
  type: string;
  data: {
    url: string;
    fee: number;
    currency: string;
    accountNumber?: string;
    fromDate?: string;
    toDate?: string;
  };
  message: string;
};
