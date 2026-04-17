import type { Handler } from '@netlify/functions';
import { callClaudeJson } from './_shared/anthropic';
import { fail, ok } from './_shared/http';
import { buildExtractFactsPrompt, globalSystemPrompt } from './_shared/prompts';
import { extractFactsRequestSchema, extractFactsResponseSchema } from './_shared/schemas';

export const handler: Handler = async (event) => {
  try {
    const body = extractFactsRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const model = process.env.ANTHROPIC_EXTRACTION_MODEL || 'claude-sonnet-4-6';
    const data = await callClaudeJson({
      model,
      system: globalSystemPrompt,
      prompt: buildExtractFactsPrompt(JSON.stringify(body.target), JSON.stringify(body.evidenceItems), body.pageText),
      maxTokens: 3500,
      retries: 2
    });
    return ok(extractFactsResponseSchema.parse(data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to extract facts.', 500, 'EXTRACT_FACTS_FAILED');
  }
};
