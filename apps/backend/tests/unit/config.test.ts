import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
vi.mock('../../src/routes/chat.js',()=>({createChatRoute:vi.fn()}));
import {createServer} from '../../src/index.js';
beforeEach(()=>{
 vi.stubEnv('BANKING_MODE','simulator');vi.stubEnv('SUPABASE_URL','http://localhost:54321');vi.stubEnv('SUPABASE_SERVICE_KEY','test');vi.stubEnv('SUPABASE_ANON_KEY','anon');vi.stubEnv('AI_ENABLED','false');vi.stubEnv('AI_MODEL','openai/gpt-4o-mini');vi.stubEnv('BANKING_MUTATIONS_ENABLED','false');
});
afterEach(()=>vi.unstubAllEnvs());
describe('Fail-closed configuration',()=>{
 it('requires database keys and explicit simulator mode',async()=>{vi.stubEnv('SUPABASE_ANON_KEY','');await expect(createServer()).rejects.toThrow('SUPABASE_ANON_KEY');vi.stubEnv('SUPABASE_ANON_KEY','anon');vi.stubEnv('BANKING_MODE','real');await expect(createServer()).rejects.toThrow('simulator');});
 it('rejects unapproved providers before agent construction',async()=>{vi.stubEnv('AI_MODEL','openrouter/auto');await expect(createServer()).rejects.toThrow('Approved');});
 it('keeps liveness independent and blocks financial mutation when disabled',async()=>{const app=await createServer();expect((await app.inject('/health')).statusCode).toBe(200);expect((await app.inject({method:'POST',url:'/api/statements/id/confirm',payload:{}})).statusCode).toBe(503);await app.close();});
});
