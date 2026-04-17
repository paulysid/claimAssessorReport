import type { Handler } from '@netlify/functions';
import { callClaudeJson } from './_shared/anthropic';
import { fail, ok } from './_shared/http';
import { buildEnrichSummaryPrompt, globalSystemPrompt } from './_shared/prompts';
import { enrichSummaryRequestSchema, enrichSummaryResponseSchema } from './_shared/schemas';

export const handler: Handler = async (event) => {
  try {
    const body = enrichSummaryRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const model = process.env.ANTHROPIC_EXTRACTION_MODEL || 'claude-sonnet-4-6';
    const data = await callClaudeJson({
      model,
      system: globalSystemPrompt,
      prompt: buildEnrichSummaryPrompt(JSON.stringify(body.target), JSON.stringify(body.facts), JSON.stringify(body.evidenceItems)),
      maxTokens: 2500,
      retries: 2
    });
    return ok(enrichSummaryResponseSchema.parse(data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to enrich summary.', 500, 'ENRICH_SUMMARY_FAILED');
  }
};
