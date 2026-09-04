import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { SupabaseClient } from '@supabase/supabase-js';

export interface CardBlockWorkflowConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
}

// Workflow state to pass data between steps
const workflowStateSchema = z.object({
  userId: z.string(),
  supabaseUrl: z.string(),
  supabaseKey: z.string(),
  cards: z.array(z.object({
    id: z.string(),
    last_4: z.string(),
    status: z.string(),
    network: z.string(),
    card_type: z.string(),
  })).optional(),
  selectedCardId: z.string().optional(),
});

// Step 1: Fetch user cards
const fetchUserCardsStep = createStep({
  id: 'fetch-user-cards',
  description: 'Fetch user cards from Supabase',
  inputSchema: workflowStateSchema,
  outputSchema: workflowStateSchema,
  execute: async ({ inputData }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(inputData.supabaseUrl, inputData.supabaseKey);

    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, last_4, status, network, card_type')
      .eq('customer_id', inputData.userId)
      .eq('status', 'ACTIVE');

    if (error) {
      throw new Error(`Failed to fetch cards: ${error.message}`);
    }

    return { ...inputData, cards: cards || [] };
  },
});

// Step 2: Ask user which card to block (suspends for user input)
const askCardSelectionStep = createStep({
  id: 'ask-card-selection',
  description: 'Ask user which card to block',
  inputSchema: workflowStateSchema,
  outputSchema: workflowStateSchema,
  suspendSchema: z.object({
    reason: z.string(),
    cards: z.array(z.object({
      id: z.string(),
      last_4: z.string(),
      status: z.string(),
      network: z.string(),
      card_type: z.string(),
    })),
  }),
  resumeSchema: z.object({
    selectedCardId: z.string(),
  }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const { cards } = inputData;
    const { selectedCardId } = resumeData ?? {};

    if (!selectedCardId) {
      return await suspend({
        reason: 'Waiting for user to select a card',
        cards: cards || [],
      });
    }

    const selectedCard = cards?.find(c => c.id === selectedCardId);
    if (!selectedCard) {
      throw new Error('Invalid card selection');
    }

    return { ...inputData, selectedCardId: selectedCard.id };
  },
});

// Step 3: Block the selected card
const blockCardStep = createStep({
  id: 'block-card',
  description: 'Block the selected card in Supabase',
  inputSchema: workflowStateSchema,
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(inputData.supabaseUrl, inputData.supabaseKey);

    const { selectedCardId } = inputData;

    if (!selectedCardId) {
      throw new Error('No card selected');
    }

    const { data: card, error: fetchError } = await supabase
      .from('cards')
      .select('last_4, card_type')
      .eq('id', selectedCardId)
      .single();

    if (fetchError || !card) {
      throw new Error('Card not found');
    }

    const { error: updateError } = await supabase
      .from('cards')
      .update({ status: 'BLOCKED', updated_at: new Date().toISOString() })
      .eq('id', selectedCardId);

    if (updateError) {
      throw new Error(`Failed to block card: ${updateError.message}`);
    }

    return {
      success: true,
      message: `Your ${card.card_type} ending in ${card.last_4} has been successfully blocked.`,
    };
  },
});

export const createCardBlockWorkflow = (config: CardBlockWorkflowConfig) => {
  return createWorkflow({
    id: 'card-block-workflow',
    description: 'Workflow to block a user\'s card with card selection and confirmation',
    inputSchema: z.object({
      userId: z.string(),
      supabaseUrl: z.string(),
      supabaseKey: z.string(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string(),
    }),
    stateSchema: workflowStateSchema,
  })
    .then(fetchUserCardsStep)
    .then(askCardSelectionStep)
    .then(blockCardStep)
    .commit();
};

export type CardBlockWorkflowInput = {
  userId: string;
  supabaseUrl: string;
  supabaseKey: string;
};

export type CardBlockWorkflowOutput = {
  success: boolean;
  message: string;
};