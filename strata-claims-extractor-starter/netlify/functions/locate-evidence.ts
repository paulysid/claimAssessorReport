import type { Handler } from '@netlify/functions';
import { callClaudeJson } from './_shared/anthropic';
import { fail, ok } from './_shared/http';
import { buildLocateEvidencePrompt, globalSystemPrompt } from './_shared/prompts';
import { locateEvidenceRequestSchema, locateEvidenceResponseSchema } from './_shared/schemas';

export const handler: Handler = async (event) => {
  try {
    const body = locateEvidenceRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const model = process.env.ANTHROPIC_ROUTING_MODEL || 'claude-sonnet-4-6';
    const data = await callClaudeJson({
      model,
      system: globalSystemPrompt,
      prompt: buildLocateEvidencePrompt(JSON.stringify(body.target), JSON.stringify(body.candidateSections), body.pageText),
      maxTokens: 3500,
      retries: 2
    });
    return ok(locateEvidenceResponseSchema.parse(data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to locate evidence.', 500, 'LOCATE_EVIDENCE_FAILED');
  }
};
