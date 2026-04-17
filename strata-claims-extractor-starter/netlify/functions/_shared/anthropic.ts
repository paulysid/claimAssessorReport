import Anthropic from '@anthropic-ai/sdk';
import { extractFirstJsonObject } from './json';

export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  return new Anthropic({ apiKey });
}

export async function callClaudeJson<T>(input: {
  model: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  retries?: number;
}): Promise<T> {
  const client = getAnthropicClient();
  const retries = input.retries ?? 2;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const message = await client.messages.create({
        model: input.model,
        system: input.system,
        max_tokens: input.maxTokens ?? 4000,
        temperature: 0,
        messages: [{ role: 'user', content: [{ type: 'text', text: input.prompt }] }]
      });

      const text = message.content
        .filter((item): item is Anthropic.TextBlock => item.type === 'text')
        .map((item) => item.text)
        .join('\n');

      const jsonText = extractFirstJsonObject(text);
      return JSON.parse(jsonText) as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Claude call failed.');
}
