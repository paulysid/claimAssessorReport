import type { Handler } from '@netlify/functions';
import { callClaudeJson } from './_shared/anthropic';
import { fail, ok } from './_shared/http';
import { buildDetectTargetsPrompt, globalSystemPrompt } from './_shared/prompts';
import { detectTargetsRequestSchema, detectTargetsResponseSchema } from './_shared/schemas';

export const handler: Handler = async (event) => {
  try {
    const body = detectTargetsRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const model = process.env.ANTHROPIC_ROUTING_MODEL || 'claude-sonnet-4-6';
    const data = await callClaudeJson({
      model,
      system: globalSystemPrompt,
      prompt: buildDetectTargetsPrompt(body.documentText),
      maxTokens: 3000,
      retries: 2
    });
    return ok(detectTargetsResponseSchema.parse(data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to detect targets.', 500, 'DETECT_TARGETS_FAILED');
  }
};
