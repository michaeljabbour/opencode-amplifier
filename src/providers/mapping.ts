/**
 * Provider mapping — translates Amplifier bundle provider module names to
 * OpenCode provider IDs and environment variable names.
 *
 * Phase 1: preserved from src/index.ts for compatibility.
 * Phase 2: replace direct env injection with runtime API provider info.
 */

export const PROVIDER_MAP: Record<string, string> = {
  "provider-anthropic": "anthropic",
  "provider-openai": "openai",
  "provider-google": "google",
  "provider-azure": "azure",
  "provider-bedrock": "amazon-bedrock",
  "provider-mistral": "mistral",
  "provider-groq": "groq",
  "provider-deepseek": "deepseek",
  "provider-xai": "xai",
  "provider-openrouter": "openrouter",
  "provider-together": "together-ai",
  "provider-fireworks": "fireworks",
  "provider-perplexity": "perplexity",
  "provider-cohere": "cohere",
}

export const PROVIDER_ENV: Record<string, string> = {
  "provider-anthropic": "ANTHROPIC_API_KEY",
  "provider-openai": "OPENAI_API_KEY",
  "provider-google": "GOOGLE_GENERATIVE_AI_API_KEY",
  "provider-azure": "AZURE_API_KEY",
  "provider-bedrock": "AWS_ACCESS_KEY_ID",
  "provider-mistral": "MISTRAL_API_KEY",
  "provider-groq": "GROQ_API_KEY",
  "provider-deepseek": "DEEPSEEK_API_KEY",
  "provider-xai": "XAI_API_KEY",
  "provider-openrouter": "OPENROUTER_API_KEY",
  "provider-together": "TOGETHER_AI_API_KEY",
  "provider-fireworks": "FIREWORKS_API_KEY",
  "provider-perplexity": "PERPLEXITY_API_KEY",
  "provider-cohere": "COHERE_API_KEY",
}

/**
 * Resolves an API key from a provider config entry.
 * If the value is a ${ENV_VAR} reference, reads from the environment.
 * Otherwise returns the literal value.
 */
export function resolveProviderEnvKey(config: Record<string, unknown>): string | undefined {
  let key = config?.api_key as string | undefined
  if (key?.startsWith("${") && key.endsWith("}")) {
    key = process.env[key.slice(2, -1)]
  }
  return key || undefined
}
