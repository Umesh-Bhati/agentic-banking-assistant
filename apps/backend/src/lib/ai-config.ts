export function aiConfiguration() {
    const provider = process.env.APPROVED_AI_PROVIDERS || 'openrouter';
    const model = provider === 'openrouter'
        ? process.env.OPENROUTER_MODEL || 'openrouter/openai/gpt-4o-mini'
        : process.env.AI_MODEL || 'openai/gpt-4o-mini';
    const valid = provider === 'openrouter'
        ? /^openrouter\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/.test(model)
        : provider === 'openai' && /^openai\/[a-zA-Z0-9.-]+$/.test(model);
    if (!valid) throw new Error('Approved AI provider and explicit model required');
    const key = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (process.env.AI_ENABLED === 'true' && !key) throw new Error('Approved AI provider key required');
    return { provider, model };
}
