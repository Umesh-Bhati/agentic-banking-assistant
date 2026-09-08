import {afterEach,describe,it,expect,vi} from 'vitest';
import {principal} from '../helpers/database.js';
const state=vi.hoisted(()=>({embed:vi.fn(),rpc:vi.fn(),lexical:vi.fn()}));
vi.mock('ai',()=>({embedMany:state.embed}));
vi.mock('@ai-sdk/openai',()=>({createOpenAI:()=>({embedding:()=>({})})}));
vi.mock('../../src/lib/shared-supabase.js',()=>({getSharedSupabaseClient:()=>({rpc:state.rpc,from:()=>({select(){return this},eq(){return this},lte(){return this},or(){return this},textSearch(){return this},limit:state.lexical})})}));
import {searchProductKnowledgeTool} from '../../src/mastra/tools/knowledge/search-product-knowledge.tool.js';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
describe('Approved knowledge provider boundary',()=>{
 it('embeds minimized queries, returns citations and no fabricated similarity',async()=>{
  vi.stubEnv('AI_ENABLED','true');vi.stubEnv('APPROVED_AI_PROVIDERS','openai');vi.stubEnv('APPROVED_EMBEDDING_PROVIDER','openai');vi.stubEnv('OPENAI_API_KEY','test-key');
  state.embed.mockResolvedValue({embeddings:[[0.1]]});state.rpc.mockResolvedValue({data:[{content:'Public banking policy',source_url:'https://almasraf.ae/policy'}],error:null});
  const context={principal,database:{},emit:vi.fn(),aliases:new Map(),signal:new AbortController().signal};
  const result=await searchProductKnowledgeTool.execute!({query:'rates for private@example.com'}, {requestContext:{get:()=>context}} as any);
  expect(JSON.stringify(state.embed.mock.calls)).not.toContain('private@example.com');
  expect(state.embed.mock.calls[0][0].abortSignal).toBeInstanceOf(AbortSignal);
  expect(result).toEqual({results:[{content:'Public banking policy',sourceUrl:'https://almasraf.ae/policy'}]});
 });
 it('uses lexical knowledge without direct OpenAI calls for OpenRouter chat',async()=>{
  vi.stubEnv('AI_ENABLED','true');vi.stubEnv('APPROVED_AI_PROVIDERS','openrouter');
  const context={principal,database:{},emit:vi.fn(),aliases:new Map()};
  vi.stubEnv('APPROVED_EMBEDDING_PROVIDER','');vi.stubEnv('OPENAI_API_KEY','placeholder');state.lexical.mockResolvedValue({data:[],error:null});
  await expect(searchProductKnowledgeTool.execute!({query:'rates'}, {requestContext:{get:()=>context}} as any)).resolves.toEqual({results:[]});expect(state.embed).not.toHaveBeenCalled();
 });
});
