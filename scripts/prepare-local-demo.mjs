import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
if (!/^project_id = "boit-security-demo"$/m.test(config)) throw new Error('Expected isolated demo project');
const status = JSON.parse(execFileSync('pnpm', ['dlx', 'supabase@2.117.0', 'status', '-o', 'json'], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
}));
if (status.API_URL !== 'http://127.0.0.1:55321') throw new Error('Unexpected demo endpoint');
let existing = {};
try { existing = parseEnv(readFileSync(resolve(root, 'apps/backend/.env'), 'utf8')); } catch { /* AI remains disabled. */ }
const providerKey = existing.OPENAI_API_KEY || '';
const hasProvider = providerKey.startsWith('sk-') && !/your_|placeholder|example/i.test(providerKey);
const env = {
  SUPABASE_URL: status.API_URL, SUPABASE_SERVICE_KEY: status.SERVICE_ROLE_KEY,
  SUPABASE_ANON_KEY: status.ANON_KEY, BANKING_MODE: 'simulator',
  BANKING_MUTATIONS_ENABLED: 'true', AI_ENABLED: String(hasProvider),
  APPROVED_AI_PROVIDERS: 'openai', AI_MODEL: 'openai/gpt-4o-mini',
  OPENAI_API_KEY: hasProvider ? providerKey : '', PORT: '3001',
};
if (!env.SUPABASE_SERVICE_KEY || !env.SUPABASE_ANON_KEY) throw new Error('Local keys unavailable');
const directory = '/private/tmp/boit-demo-runtime';
mkdirSync(directory, { recursive: true, mode: 0o700 });
chmodSync(directory, 0o700);
const path = resolve(directory, 'backend.env');
writeFileSync(path, Object.entries(env).map(([key, value]) => key + '=' + JSON.stringify(value)).join('\n') + '\n', { mode: 0o600 });
chmodSync(path, 0o600);
console.log('Demo environment prepared at ' + path + '; AI ' + (hasProvider ? 'enabled (provider will verify key)' : 'disabled (valid OpenAI key required)') + '. Original .env unchanged.');
