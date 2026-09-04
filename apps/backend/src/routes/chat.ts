import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Mastra } from '@mastra/core';
import { createProductKnowledgeAgent } from '../agents/product-knowledge-agent.js';
import { createIntentRouterAgent } from '../agents/intent-router-agent.js';
import { createCardBlockWorkflow, CardBlockWorkflowInput, CardBlockWorkflowOutput } from '../workflows/card-block-workflow.js';
import { createStatementWorkflow } from '../workflows/statement-workflow.js';
import type { ActiveWorkflowState, WorkflowState, IntentResult } from '@boit/types';

export const activeRuns = new Map<string, any>();

interface ChatRequest {
  message: string;
  sessionId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

type CoreUserMessage = { role: 'user'; content: string };
type CoreAssistantMessage = { role: 'assistant'; content: string };
type CoreMessage = CoreUserMessage | CoreAssistantMessage;

interface WorkflowRunResult {
  status: 'suspended' | 'success' | 'failed';
  suspended?: string[];
  suspendData?: any;
  output?: CardBlockWorkflowOutput;
  runId: string;
  error?: string;
}

async function getChatSession(supabase: SupabaseClient, sessionId: string): Promise<ActiveWorkflowState | null> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('active_workflow_state')
    .eq('id', sessionId)
    .single();

  if (error || !data?.active_workflow_state) {
    return null;
  }
  return data.active_workflow_state as ActiveWorkflowState;
}

async function updateChatSessionWorkflowState(
  supabase: SupabaseClient,
  sessionId: string,
  workflowState: ActiveWorkflowState | null
): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ 
      active_workflow_state: workflowState,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

async function clearChatSessionWorkflowState(
  supabase: SupabaseClient,
  sessionId: string
): Promise<void> {
  await supabase
    .from('chat_sessions')
    .update({ 
      active_workflow_state: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

async function getCustomerId(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('customer_profiles')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    // Fallback for demo sessions to first customer profile (John Doe)
    const { data: fallbackProfile } = await supabase
      .from('customer_profiles')
      .select('id')
      .limit(1)
      .single();
    return fallbackProfile?.id || null;
  }
  return data.id;
}

export function createChatRoute(
  fastify: FastifyInstance,
  config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
    openaiApiKey: string;
    openrouterApiKey: string;
  }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const productAgent = createProductKnowledgeAgent({
    supabase,
    openaiApiKey: config.openaiApiKey,
    openrouterApiKey: config.openrouterApiKey,
  });
  const intentRouter = createIntentRouterAgent({
    supabase,
    openaiApiKey: config.openaiApiKey,
    openrouterApiKey: config.openrouterApiKey,
  });
  const cardBlockWorkflowRaw = createCardBlockWorkflow({ 
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
  });
  const statementWorkflowRaw = createStatementWorkflow({
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
  });
  const mastra = new Mastra({
    workflows: {
      cardBlockWorkflow: cardBlockWorkflowRaw,
      statementWorkflow: statementWorkflowRaw,
    },
  });
  const cardBlockWorkflow = mastra.getWorkflow('cardBlockWorkflow');
  const statementWorkflow = mastra.getWorkflow('statementWorkflow');

  fastify.post<{
    Body: ChatRequest;
  }>('/api/chat', async (request: FastifyRequest<{ Body: ChatRequest }>, reply: FastifyReply) => {
    const { message, sessionId, history = [] } = request.body;

    if (!message || !sessionId) {
      return reply.code(400).send({ error: 'Missing message or sessionId' });
    }

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const sendEvent = (data: string) => {
      reply.raw.write(`data: ${data}\n\n`);
    };

    const sendError = (error: string) => {
      sendEvent(JSON.stringify({ type: 'error', error }));
    };

    const sendToken = (token: string) => {
      sendEvent(JSON.stringify({ type: 'token', content: token }));
    };

    const sendDone = (workflowState?: ActiveWorkflowState | null) => {
      sendEvent(JSON.stringify({ type: 'done', workflowState }));
    };

    const sendWorkflowSuspended = (workflowState: ActiveWorkflowState, suspendData?: any) => {
      sendEvent(JSON.stringify({ type: 'workflow_suspended', workflowState, suspendData }));
    };

    const sendAuthRequired = (workflowState: ActiveWorkflowState, suspendData?: any) => {
      const stepSuspendData = suspendData?.['wait-for-auth'] || suspendData;
      sendEvent(JSON.stringify({ 
        type: 'auth_required', 
        workflowState, 
        suspendData: stepSuspendData,
        cardType: stepSuspendData?.cardType,
        last4: stepSuspendData?.last4,
      }));
    };

    const sendStatementCard = (data: any) => {
      sendEvent(JSON.stringify({ 
        type: 'STATEMENT_CARD', 
        data 
      }));
    };

    try {
      // Check for existing active workflow
      const existingWorkflowState = await getChatSession(supabase, sessionId);
      
      // Use Intent Router to classify ALL messages (including cancel)
      const intentResult = await classifyIntent(intentRouter, message);
      
      // Handle CANCEL intent via Intent Router
      if (intentResult.intent === 'CANCEL_WORKFLOW' && existingWorkflowState) {
        await clearChatSessionWorkflowState(supabase, sessionId);
        sendToken('Workflow cancelled. How can I help you?');
        sendDone(null);
        return;
      }

      // If there's an active workflow, resume it
      if (existingWorkflowState) {
        await handleActiveWorkflow({ cardBlockWorkflow, statementWorkflow }, existingWorkflowState, message, sessionId, config, {
          sendToken,
          sendDone,
          sendWorkflowSuspended,
          sendError,
          sendAuthRequired,
          sendStatementCard,
        });
        return;
      }

      // No active workflow - route based on intent
      if (intentResult.intent === 'BLOCK_CARD') {
        await startCardBlockWorkflow(cardBlockWorkflow, sessionId, config, {
          sendToken,
          sendDone,
          sendWorkflowSuspended,
          sendError,
        });
        return;
      }

      if (intentResult.intent === 'STATEMENT_REQUEST') {
        await startStatementWorkflow(statementWorkflow, sessionId, config, {
          sendToken,
          sendDone,
          sendWorkflowSuspended,
          sendError,
          sendStatementCard,
        });
        return;
      }

      if (intentResult.intent === 'ACCOUNT_INQUIRY') {
        await handleAccountInquiry(sessionId, {
          sendToken,
          sendDone,
          sendError,
        });
        return;
      }

      if (intentResult.intent === 'PRODUCT_QUESTION') {
        await handleProductQuestion(productAgent, message, history, {
          sendToken,
          sendDone,
          sendError,
        });
        return;
      }

      // Default fallback
      sendToken("I'm here to help with Al Masraf banking products. You can ask about accounts, cards, loans, or request to block a card.");
      sendDone();

    } catch (error) {
      console.error('Chat error:', error);
      sendError(error instanceof Error ? error.message : 'Internal server error');
      sendDone();
    } finally {
      reply.raw.end();
    }
  });

  async function classifyIntent(agent: ReturnType<typeof createIntentRouterAgent>, message: string): Promise<IntentResult> {
    try {
      const messages: CoreMessage[] = [{ role: 'user', content: message }];
      const result = await agent.generate(messages, { maxSteps: 1 });
      const text = result.text || '{}';
      const parsed = JSON.parse(text);
      return parsed as IntentResult;
    } catch {
      // Fallback: simple keyword matching
      const lower = message.toLowerCase();
      if (lower.includes('block') && (lower.includes('card') || lower.includes('stop'))) {
        return { intent: 'BLOCK_CARD', confidence: 0.8, reasoning: 'Keyword match for card blocking' };
      }
      if (lower.includes('balance') || lower.includes('my account') || lower.includes('my balance') || lower.includes('my transactions')) {
        return { intent: 'ACCOUNT_INQUIRY', confidence: 0.9, reasoning: 'Keyword match for account inquiry' };
      }
      if (lower.includes('statement') || lower.includes('transaction history')) {
        return { intent: 'STATEMENT_REQUEST', confidence: 0.8, reasoning: 'Keyword match for statement request' };
      }
      if (['cancel', 'go back', 'never mind', 'stop', 'abort'].some(kw => lower.includes(kw))) {
        return { intent: 'CANCEL_WORKFLOW', confidence: 0.7, reasoning: 'Keyword match for cancel' };
      }
      return { intent: 'PRODUCT_QUESTION', confidence: 0.5, reasoning: 'Default to product question' };
    }
  }

  async function handleProductQuestion(
    agent: ReturnType<typeof createProductKnowledgeAgent>,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendError: (e: string) => void }
  ) {
    const messages: CoreMessage[] = [
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    const stream = await agent.stream(messages, { maxSteps: 5 });
    for await (const chunk of stream.textStream) {
      if (chunk) callbacks.sendToken(chunk);
    }
    callbacks.sendDone();
  }

  async function handleAccountInquiry(
    sessionId: string,
    callbacks: { sendToken: (t: string) => void; sendDone: () => void; sendError: (e: string) => void }
  ) {
    try {
      const customerId = await getCustomerId(supabase, sessionId);
      if (!customerId) {
        callbacks.sendError('Customer profile not found.');
        callbacks.sendDone();
        return;
      }

      // Fetch customer profile
      const { data: profile } = await supabase
        .from('customer_profiles')
        .select('full_name')
        .eq('id', customerId)
        .single();

      // Fetch bank accounts
      const { data: accounts } = await supabase
        .from('bank_accounts')
        .select('id, account_number, balance, currency, type, status')
        .eq('customer_id', customerId);

      if (!accounts || accounts.length === 0) {
        callbacks.sendToken('No active bank accounts found for your profile.');
        callbacks.sendDone();
        return;
      }

      let summary = `Hello ${profile?.full_name || 'Valued Customer'}, here are your account details:\n\n`;
      accounts.forEach((acc, i) => {
        summary += `${i + 1}. **${acc.type} Account** (${acc.account_number})\n`;
        summary += `   - **Balance:** ${Number(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${acc.currency}\n`;
        summary += `   - **Status:** ${acc.status}\n\n`;
      });

      // Fetch recent 3 transactions from first account
      const { data: recentTxs } = await supabase
        .from('transactions')
        .select('description, amount, currency, created_at')
        .eq('account_id', accounts[0].id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentTxs && recentTxs.length > 0) {
        summary += `**Recent Transactions:**\n`;
        recentTxs.forEach(tx => {
          const numAmount = Number(tx.amount);
          const formattedAmount = numAmount < 0 ? `${numAmount.toFixed(2)}` : `+${numAmount.toFixed(2)}`;
          summary += `- ${tx.description}: **${formattedAmount} ${tx.currency}**\n`;
        });
      }

      callbacks.sendToken(summary);
      callbacks.sendDone();
    } catch (error) {
      console.error('Account inquiry error:', error);
      callbacks.sendError(error instanceof Error ? error.message : 'Failed to retrieve account details');
      callbacks.sendDone();
    }
  }

  async function startCardBlockWorkflow(
    workflow: ReturnType<typeof createCardBlockWorkflow>,
    sessionId: string,
    config: { supabaseUrl: string; supabaseServiceKey: string },
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendWorkflowSuspended: (ws: ActiveWorkflowState, sd?: any) => void; sendError: (e: string) => void }
  ) {
    try {
      // Get customer_id from user_id (sessionId)
      const customerId = await getCustomerId(supabase, sessionId);
      if (!customerId) {
        callbacks.sendError('Customer profile not found');
        callbacks.sendDone();
        return;
      }

      // Create workflow run
      const run = await workflow.createRun();
      
      // Start workflow
      const result = await run.start({ 
        inputData: { 
          userId: customerId,
          supabaseUrl: config.supabaseUrl,
          supabaseKey: config.supabaseServiceKey,
        } as CardBlockWorkflowInput 
      });

      const workflowResult = result as unknown as WorkflowRunResult;

      if (workflowResult.status === 'suspended') {
        activeRuns.set(workflowResult.runId, run);
        // Workflow suspended - waiting for card selection
        const suspendedStepName = Array.isArray(workflowResult.suspended?.[0]) 
          ? workflowResult.suspended[0][0] 
          : workflowResult.suspended?.[0];
        const workflowState: ActiveWorkflowState = {
          workflow_type: 'card-block-workflow',
          step: 'WAITING_CARD_SELECTION',
          data: { runId: workflowResult.runId, suspendedStep: suspendedStepName },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await updateChatSessionWorkflowState(supabase, sessionId, workflowState);
        
        // Send the suspend message from workflow (should match spec: "Which of your 3 cards...")
        const suspendData = (workflowResult as any).suspendPayload || workflowResult.suspendData;
        const suspendMessage = suspendData?.reason || suspendData?.['ask-card-selection']?.reason || 'Which of your 3 cards would you like to block?';
        callbacks.sendToken(suspendMessage);
        callbacks.sendWorkflowSuspended(workflowState, suspendData);
      } else if (workflowResult.status === 'success') {
        callbacks.sendToken(workflowResult.output?.message || 'Card blocked successfully.');
        callbacks.sendDone();
      }
    } catch (error) {
      console.error('Card block workflow error:', error);
      callbacks.sendError(error instanceof Error ? error.message : 'Failed to start card block workflow');
      callbacks.sendDone();
    }
  }

  async function startStatementWorkflow(
    workflow: any,
    sessionId: string,
    config: { supabaseUrl: string; supabaseServiceKey: string },
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendWorkflowSuspended: (ws: ActiveWorkflowState, sd?: any) => void; sendError: (e: string) => void; sendStatementCard?: (data: any) => void }
  ) {
    try {
      const customerId = await getCustomerId(supabase, sessionId);
      if (!customerId) {
        callbacks.sendError('Customer profile not found');
        callbacks.sendDone();
        return;
      }

      const run = await workflow.createRun();
      const result = await run.start({ 
        inputData: { 
          userId: customerId,
          supabaseUrl: config.supabaseUrl,
          supabaseKey: config.supabaseServiceKey,
        } 
      });

      const workflowResult = result as unknown as any;

      if (workflowResult.status === 'suspended') {
        activeRuns.set(workflowResult.runId, run);
        const suspendedStepName = Array.isArray(workflowResult.suspended?.[0]) 
          ? workflowResult.suspended[0][0] 
          : workflowResult.suspended?.[0];
        const workflowState: ActiveWorkflowState = {
          workflow_type: 'statement-workflow',
          step: 'WAITING_FEE_ACCEPTANCE',
          data: { runId: workflowResult.runId, suspendedStep: suspendedStepName },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await updateChatSessionWorkflowState(supabase, sessionId, workflowState);
        
        const suspendData = workflowResult.suspendPayload || workflowResult.suspendData;
        const stepData = suspendData?.['ask-fee-acceptance'] || suspendData;
        const suspendMessage = stepData?.reason || 'Generating this statement will cost 25 AED. Do you accept?';
        callbacks.sendToken(suspendMessage);
        callbacks.sendWorkflowSuspended(workflowState, stepData);
      } else if (workflowResult.status === 'success') {
        const outputData = workflowResult.output?.data || workflowResult.result?.data;
        if (outputData) {
          callbacks.sendStatementCard?.(outputData);
        }
        callbacks.sendToken(workflowResult.output?.message || workflowResult.result?.message || 'Statement generated successfully.');
        callbacks.sendDone();
      }
    } catch (error) {
      console.error('Statement workflow error:', error);
      callbacks.sendError(error instanceof Error ? error.message : 'Failed to start statement workflow');
      callbacks.sendDone();
    }
  }

  async function handleActiveWorkflow(
    workflows: { cardBlockWorkflow: any; statementWorkflow: any },
    workflowState: ActiveWorkflowState,
    message: string,
    sessionId: string,
    config: { supabaseUrl: string; supabaseServiceKey: string },
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendWorkflowSuspended: (ws: ActiveWorkflowState, sd?: any) => void; sendError: (e: string) => void; sendAuthRequired?: (ws: ActiveWorkflowState, sd?: any) => void; sendStatementCard?: (data: any) => void }
  ) {
    try {
      if (workflowState.workflow_type === 'card-block-workflow') {
        const runId = workflowState.data?.runId as string | undefined;
        const suspendedStep = workflowState.data?.suspendedStep as string | undefined;
        
        if (!runId) {
          throw new Error('Invalid workflow state: missing runId');
        }

        // Get customer_id
        const customerId = await getCustomerId(supabase, sessionId);
        if (!customerId) {
          throw new Error('Customer profile not found');
        }

        let run = activeRuns.get(runId);
        if (!run) {
          run = await workflows.cardBlockWorkflow.createRun({ runId });
          activeRuns.set(runId, run);
        }
        
        // Determine resume data based on current step
        let resumeData: any = {};
        if (workflowState.step === 'WAITING_CARD_SELECTION') {
          // User is selecting a card - try to match last 4 digits
          const cardMatch = message.match(/\d{4}/);
          if (cardMatch) {
            // Get cards from Supabase to match
            const { data: cards } = await supabase
              .from('cards')
              .select('id, last_4')
              .eq('customer_id', customerId)
              .eq('status', 'ACTIVE');
            
            const matchedCard = cards?.find(c => c.last_4 === cardMatch[0]);
            if (matchedCard) {
              resumeData = { selectedCardId: matchedCard.id };
            } else {
              callbacks.sendToken('Could not find that card. Please provide the last 4 digits of one of your active cards.');
              callbacks.sendWorkflowSuspended(workflowState);
              return;
            }
          } else {
            callbacks.sendToken('Please provide the last 4 digits of the card you want to block.');
            callbacks.sendWorkflowSuspended(workflowState);
            return;
          }
        }

        const result = await run.resume({
          step: suspendedStep!,
          resumeData,
        });

        const workflowResult = result as unknown as WorkflowRunResult;

        if (workflowResult.status === 'suspended') {
          // Still suspended - update state
          const suspendedStepName = Array.isArray(workflowResult.suspended?.[0]) 
            ? workflowResult.suspended[0][0] 
            : workflowResult.suspended?.[0];
          const isAuthStep = suspendedStepName === 'wait-for-auth';
          const newWorkflowState: ActiveWorkflowState = {
            ...workflowState,
            step: isAuthStep ? 'WAITING_FOR_AUTH' : 'WAITING_CARD_SELECTION',
            data: { ...workflowState.data, runId, suspendedStep: suspendedStepName },
            updated_at: new Date().toISOString(),
          };
          
          await updateChatSessionWorkflowState(supabase, sessionId, newWorkflowState);
          
          const suspendData = (workflowResult as any).suspendPayload || workflowResult.suspendData;
          if (isAuthStep) {
            // Send auth_required signal for the mobile app to show PIN modal
            const stepData = suspendData?.['wait-for-auth'] || suspendData;
            const suspendMessage = stepData?.reason || 'Please enter your PIN or use Face ID to authorize.';
            callbacks.sendToken(suspendMessage);
            callbacks.sendAuthRequired?.(newWorkflowState, stepData);
          } else {
            const stepData = suspendData?.['ask-card-selection'] || suspendData;
            const suspendMessage = stepData?.reason || 'Please provide the last 4 digits of the card you want to block.';
            callbacks.sendToken(suspendMessage);
            callbacks.sendWorkflowSuspended(newWorkflowState, stepData);
          }
        } else if (workflowResult.status === 'success') {
          activeRuns.delete(runId);
          await clearChatSessionWorkflowState(supabase, sessionId);
          callbacks.sendToken(workflowResult.output?.message || 'Card blocked successfully.');
          callbacks.sendDone(null);
        } else {
          throw new Error(`Workflow ended with status: ${workflowResult.status}`);
        }
      } else if (workflowState.workflow_type === 'statement-workflow') {
        const runId = workflowState.data?.runId as string | undefined;
        const suspendedStep = workflowState.data?.suspendedStep as string | undefined;

        if (!runId) {
          throw new Error('Invalid workflow state: missing runId');
        }

        const customerId = await getCustomerId(supabase, sessionId);
        if (!customerId) {
          throw new Error('Customer profile not found');
        }

        let run = activeRuns.get(runId);
        if (!run) {
          run = await workflows.statementWorkflow.createRun({ runId });
          activeRuns.set(runId, run);
        }

        let resumeData: any = {};
        if (workflowState.step === 'WAITING_FEE_ACCEPTANCE') {
          const lower = message.toLowerCase();
          const accepted = ['yes', 'accept', 'ok', 'sure', 'confirm', 'agree', 'yep', 'yeah', 'proceed'].some(kw => lower.includes(kw));
          resumeData = { accepted };
        }

        const result = await run.resume({
          step: suspendedStep!,
          resumeData,
        });

        const workflowResult = result as unknown as any;

        if (workflowResult.status === 'suspended') {
          const suspendedStepName = Array.isArray(workflowResult.suspended?.[0]) 
            ? workflowResult.suspended[0][0] 
            : workflowResult.suspended?.[0];
          const newWorkflowState: ActiveWorkflowState = {
            ...workflowState,
            step: 'WAITING_FEE_ACCEPTANCE',
            data: { ...workflowState.data, runId, suspendedStep: suspendedStepName },
            updated_at: new Date().toISOString(),
          };

          await updateChatSessionWorkflowState(supabase, sessionId, newWorkflowState);

          const suspendData = workflowResult.suspendPayload || workflowResult.suspendData;
          const stepData = suspendData?.['ask-fee-acceptance'] || suspendData;
          const suspendMessage = stepData?.reason || 'Generating this statement will cost 25 AED. Do you accept?';
          callbacks.sendToken(suspendMessage);
          callbacks.sendWorkflowSuspended(newWorkflowState, stepData);
        } else if (workflowResult.status === 'success') {
          activeRuns.delete(runId);
          await clearChatSessionWorkflowState(supabase, sessionId);
          const outputData = workflowResult.output?.data || workflowResult.result?.data;
          if (outputData) {
            callbacks.sendStatementCard?.(outputData);
          }
          callbacks.sendToken(workflowResult.output?.message || workflowResult.result?.message || 'Your account statement has been generated successfully.');
          callbacks.sendDone(null);
        } else {
          throw new Error(`Workflow ended with status: ${workflowResult.status}`);
        }
      } else {
        throw new Error(`Unknown workflow type: ${workflowState.workflow_type}`);
      }
    } catch (error) {
      console.error('Active workflow error:', error);
      callbacks.sendError(error instanceof Error ? error.message : 'Workflow error');
      callbacks.sendDone();
    }
  }
}

export interface AuthRequest {
  authToken: string;
  sessionId: string;
}

export function createAuthRoute(
  fastify: FastifyInstance,
  config: {
    supabaseUrl: string;
    supabaseServiceKey: string;
  }
) {
  const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  const cardBlockWorkflowRaw = createCardBlockWorkflow({ 
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
  });
  const mastra = new Mastra({
    workflows: {
      cardBlockWorkflow: cardBlockWorkflowRaw,
    },
  });
  const cardBlockWorkflow = mastra.getWorkflow('cardBlockWorkflow');

  fastify.post<{
    Body: AuthRequest;
  }>('/api/auth', async (request: FastifyRequest<{ Body: AuthRequest }>, reply: FastifyReply) => {
    const { authToken, sessionId } = request.body;

    if (!authToken || !sessionId) {
      return reply.code(400).send({ error: 'Missing authToken or sessionId' });
    }

    // Check for existing active workflow
    const existingWorkflowState = await getChatSession(supabase, sessionId);
    
    if (!existingWorkflowState) {
      return reply.code(404).send({ error: 'No active workflow found' });
    }

    if (existingWorkflowState.step !== 'WAITING_FOR_AUTH') {
      return reply.code(400).send({ error: 'Workflow not waiting for authorization' });
    }

    try {
      const runId = existingWorkflowState.data?.runId as string | undefined;
      const suspendedStep = existingWorkflowState.data?.suspendedStep as string | undefined;
      
      if (!runId) {
        return reply.code(400).send({ error: 'Invalid workflow state: missing runId' });
      }

      let run = activeRuns.get(runId);
      if (!run) {
        run = await cardBlockWorkflow.createRun({ runId });
        activeRuns.set(runId, run);
      }
      
      const result = await run.resume({
        step: suspendedStep!,
        resumeData: { authToken },
      });

      const workflowResult = result as unknown as WorkflowRunResult;

      if (workflowResult.status === 'success') {
        activeRuns.delete(runId);
        await clearChatSessionWorkflowState(supabase, sessionId);
        return reply.send({ 
          success: true, 
          message: workflowResult.output?.message || 'Card blocked successfully.' 
        });
      } else if (workflowResult.status === 'failed') {
        return reply.code(401).send({ error: workflowResult.error || 'Authorization failed' });
      } else {
        return reply.code(500).send({ error: 'Unexpected workflow state' });
      }
    } catch (error) {
      console.error('Auth endpoint error:', error);
      return reply.code(500).send({ error: error instanceof Error ? error.message : 'Internal server error' });
    }
  });
}