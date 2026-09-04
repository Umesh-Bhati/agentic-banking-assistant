import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createProductKnowledgeAgent } from '../agents/product-knowledge-agent.js';
import { createIntentRouterAgent } from '../agents/intent-router-agent.js';
import { createCardBlockWorkflow, CardBlockWorkflowInput, CardBlockWorkflowOutput } from '../workflows/card-block-workflow.js';
import type { ActiveWorkflowState, WorkflowState } from '@boit/types';

interface ChatRequest {
  message: string;
  sessionId: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

type CoreUserMessage = { role: 'user'; content: string };
type CoreAssistantMessage = { role: 'assistant'; content: string };
type CoreMessage = CoreUserMessage | CoreAssistantMessage;

interface IntentResult {
  intent: string;
  confidence: number;
  reasoning: string;
}

interface WorkflowRunResult {
  status: 'suspended' | 'success' | 'failed';
  suspended?: string[];
  suspendData?: any;
  output?: CardBlockWorkflowOutput;
  runId: string;
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
  const cardBlockWorkflow = createCardBlockWorkflow({ 
    supabaseUrl: config.supabaseUrl,
    supabaseServiceKey: config.supabaseServiceKey,
  });

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

    try {
      // Check for existing active workflow
      const existingWorkflowState = await getChatSession(supabase, sessionId);
      
      // Handle CANCEL intent
      const cancelKeywords = ['cancel', 'go back', 'never mind', 'stop', 'abort'];
      const isCancel = cancelKeywords.some(kw => message.toLowerCase().includes(kw));
      
      if (isCancel && existingWorkflowState) {
        await clearChatSessionWorkflowState(supabase, sessionId);
        sendToken('Workflow cancelled. How can I help you?');
        sendDone(null);
        return;
      }

      // If there's an active workflow, resume it
      if (existingWorkflowState) {
        await handleActiveWorkflow(existingWorkflowState, message, sessionId, config, {
          sendToken,
          sendDone,
          sendWorkflowSuspended,
          sendError,
        });
        return;
      }

      // No active workflow - use intent router to classify
      const intentResult = await classifyIntent(intentRouter, message);
      
      if (intentResult.intent === 'BLOCK_CARD') {
        // Start CardBlockWorkflow
        await startCardBlockWorkflow(cardBlockWorkflow, sessionId, config, {
          sendToken,
          sendDone,
          sendWorkflowSuspended,
          sendError,
        });
        return;
      }

      if (intentResult.intent === 'PRODUCT_QUESTION') {
        // Use Product Knowledge Agent
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
    const messages: CoreMessage[] = [{ role: 'user', content: message }];
    const result = await agent.generate(messages, { maxSteps: 1 });
    
    try {
      const text = result.text || '{}';
      const parsed = JSON.parse(text);
      return parsed as IntentResult;
    } catch {
      // Fallback: simple keyword matching
      const lower = message.toLowerCase();
      if (lower.includes('block') && (lower.includes('card') || lower.includes('stop'))) {
        return { intent: 'BLOCK_CARD', confidence: 0.8, reasoning: 'Keyword match for card blocking' };
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

  async function startCardBlockWorkflow(
    workflow: ReturnType<typeof createCardBlockWorkflow>,
    sessionId: string,
    config: { supabaseUrl: string; supabaseServiceKey: string },
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendWorkflowSuspended: (ws: ActiveWorkflowState, sd?: any) => void; sendError: (e: string) => void }
  ) {
    try {
      // Create workflow run
      const run = await workflow.createRun();
      
      // Start workflow
      const result = await run.start({ 
        inputData: { 
          userId: sessionId,
          supabaseUrl: config.supabaseUrl,
          supabaseKey: config.supabaseServiceKey,
        } as CardBlockWorkflowInput 
      });

      const workflowResult = result as unknown as WorkflowRunResult;

      if (workflowResult.status === 'suspended') {
        // Workflow suspended - waiting for card selection
        const workflowState: ActiveWorkflowState = {
          workflow_type: 'card-block-workflow',
          step: 'WAITING_CARD_SELECTION',
          data: { runId: workflowResult.runId, suspendedStep: workflowResult.suspended?.[0] },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        await updateChatSessionWorkflowState(supabase, sessionId, workflowState);
        
        // Send the suspend message from workflow
        const suspendMessage = workflowResult.suspendData?.reason || 'Which card would you like to block?';
        callbacks.sendToken(suspendMessage);
        callbacks.sendWorkflowSuspended(workflowState, workflowResult.suspendData);
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

  async function handleActiveWorkflow(
    workflowState: ActiveWorkflowState,
    message: string,
    sessionId: string,
    config: { supabaseUrl: string; supabaseServiceKey: string },
    callbacks: { sendToken: (t: string) => void; sendDone: (ws?: ActiveWorkflowState | null) => void; sendWorkflowSuspended: (ws: ActiveWorkflowState, sd?: any) => void; sendError: (e: string) => void }
  ) {
    try {
      if (workflowState.workflow_type === 'card-block-workflow') {
        const runId = workflowState.data?.runId as string | undefined;
        const suspendedStep = workflowState.data?.suspendedStep as string | undefined;
        
        if (!runId) {
          throw new Error('Invalid workflow state: missing runId');
        }

        // Recreate workflow and resume
        const workflow = createCardBlockWorkflow({ 
          supabaseUrl: config.supabaseUrl,
          supabaseServiceKey: config.supabaseServiceKey,
        });
        const run = await workflow.createRun({ runId });
        
        // Determine resume data based on current step
        let resumeData: any = {};
        if (workflowState.step === 'WAITING_CARD_SELECTION') {
          // User is selecting a card - try to match last 4 digits
          const cardMatch = message.match(/\d{4}/);
          if (cardMatch) {
            // We need to find the card ID from the last 4 digits
            // Get cards from Supabase to match
            const { data: cards } = await supabase
              .from('cards')
              .select('id, last_4')
              .eq('customer_id', sessionId)
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
          const newWorkflowState: ActiveWorkflowState = {
            ...workflowState,
            step: 'WAITING_FOR_AUTH' as WorkflowState,
            data: { ...workflowState.data, runId, suspendedStep: workflowResult.suspended?.[0] },
            updated_at: new Date().toISOString(),
          };
          
          await updateChatSessionWorkflowState(supabase, sessionId, newWorkflowState);
          
          const suspendMessage = workflowResult.suspendData?.reason || 'Please confirm with your PIN.';
          callbacks.sendToken(suspendMessage);
          callbacks.sendWorkflowSuspended(newWorkflowState, workflowResult.suspendData);
        } else if (workflowResult.status === 'success') {
          await clearChatSessionWorkflowState(supabase, sessionId);
          callbacks.sendToken(workflowResult.output?.message || 'Card blocked successfully.');
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