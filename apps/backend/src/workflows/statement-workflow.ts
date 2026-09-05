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

// Step 1: Ask for date range if not provided
const askDateRangeStep = createStep({
  id: 'ask-date-range',
  description: 'Ask user for date range for statement generation',
  inputSchema: statementWorkflowStateSchema,
  outputSchema: statementWorkflowStateSchema,
  suspendSchema: z.object({
    reason: z.string(),
  }),
  resumeSchema: z.object({
    fromDate: z.string(),
    toDate: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData) {
      return { ...inputData, ...resumeData };
    }
    if (!inputData.fromDate || !inputData.toDate) {
      return await suspend({
        reason: 'What time period would you like the statement for? (e.g. Last month, past 3 months)',
      });
    }
    return inputData;
  },
});

// Step 2: Ask for account selection if multiple accounts exist
const askAccountSelectionStep = createStep({
  id: 'ask-account-selection',
  description: 'Ask user to select account if multiple exist',
  inputSchema: statementWorkflowStateSchema,
  outputSchema: statementWorkflowStateSchema,
  suspendSchema: z.object({
    reason: z.string(),
    accounts: z.array(z.any()),
  }),
  resumeSchema: z.object({
    accountId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (resumeData && resumeData.accountId) {
      return { ...inputData, accountId: resumeData.accountId };
    }
    if (!inputData.accountId) {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(inputData.supabaseUrl!, inputData.supabaseKey!);
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, account_number, type, currency, balance')
        .eq('customer_id', inputData.userId!);
        
      if (accounts && accounts.length > 1) {
        return await suspend({
          reason: 'Which account would you like the statement for?',
          accounts,
        });
      } else if (accounts && accounts.length === 1) {
        return { ...inputData, accountId: accounts[0].id };
      }
    }
    return inputData;
  },
});

// Step 3: Ask for fee acceptance (25 AED)
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

// Step 4: Deduct fee and generate statement payload
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

    let query = supabase
      .from('bank_accounts')
      .select('id, account_number, balance, currency')
      .eq('customer_id', inputData.userId!);
      
    if (inputData.accountId) {
      query = query.eq('id', inputData.accountId);
    }
    
    const { data: account, error: accountError } = await query.limit(1).single();

    if (accountError || !account) {
      throw new Error('Bank account not found');
    }

    const feeAmount = 25.00;

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
        url: `http://localhost:3000/api/statements?accountId=${account.id}&fromDate=${inputData.fromDate || ''}&toDate=${inputData.toDate || ''}`,
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
    .then(askDateRangeStep)
    .then(askAccountSelectionStep)
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
