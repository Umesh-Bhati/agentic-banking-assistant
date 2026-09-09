export function aiConfiguration() {
    const provider = process.env.APPROVED_AI_PROVIDERS || 'openrouter';
    const model = provider === 'openrouter'
        ? process.env.OPENROUTER_MODEL || 'openrouter/google/gemini-2.5-flash'
        : process.env.AI_MODEL || 'openai/gpt-4o-mini';
    const valid = provider === 'openrouter'
        ? /^openrouter\/[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+$/.test(model)
        : provider === 'openai' && /^openai\/[a-zA-Z0-9.-]+$/.test(model);
    if (!valid) throw new Error('Approved AI provider and explicit model required');
    const key = provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
    if (process.env.AI_ENABLED === 'true' && !key) throw new Error('Approved AI provider key required');
    if (provider !== 'openrouter') return { provider, model, providerOptions: undefined };
    const allowedProviders = (process.env.OPENROUTER_ALLOWED_PROVIDERS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (process.env.AI_ENABLED === 'true' && (allowedProviders.length === 0 || allowedProviders.some(value => !/^[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)?$/.test(value)))) {
        throw new Error('OpenRouter requires an explicit valid provider allowlist');
    }
    return {
        provider,
        model,
        providerOptions: {
            openrouter: {
                provider: {
                    only: allowedProviders,
                    order: allowedProviders,
                    allow_fallbacks: false,
                    require_parameters: true,
                    data_collection: 'deny',
                    zdr: true,
                },
            },
        },
    };
}
