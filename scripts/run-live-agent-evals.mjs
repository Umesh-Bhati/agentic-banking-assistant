import { spawnSync } from 'node:child_process';

const required = {
  LIVE_AGENT_EVALS: 'true',
  AI_EVAL_SYNTHETIC_ONLY: 'true',
  AI_ENABLED: 'true',
  BANKING_MUTATIONS_ENABLED: 'false',
};
for (const [name, expected] of Object.entries(required)) {
  if (process.env[name] !== expected) {
    console.error(`Live agent eval refused: ${name} must be exactly ${expected}.`);
    process.exit(2);
  }
}

const result = spawnSync('pnpm', ['--filter', '@boit/backend', 'exec', 'vitest', 'run', 'tests/evals/live-agent.eval.test.ts'], {
  cwd: new URL('..', import.meta.url), env: process.env, stdio: 'inherit',
});
process.exit(result.status ?? 1);
