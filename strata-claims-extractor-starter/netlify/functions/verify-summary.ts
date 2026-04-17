import type { Handler } from '@netlify/functions';
import { callClaudeJson } from './_shared/anthropic';
import { fail, ok } from './_shared/http';
import { buildVerifySummaryPrompt, globalSystemPrompt } from './_shared/prompts';
import { verifySummaryRequestSchema, verifySummaryResponseSchema } from './_shared/schemas';

export const handler: Handler = async (event) => {
  try {
    const body = verifySummaryRequestSchema.parse(JSON.parse(event.body ?? '{}'));
    const model = process.env.ANTHROPIC_VERIFICATION_MODEL || 'claude-sonnet-4-6';
    const data = await callClaudeJson({
      model,
      system: globalSystemPrompt,
      prompt: buildVerifySummaryPrompt(
        JSON.stringify(body.target),
        JSON.stringify(body.facts),
        body.draftSummary,
        JSON.stringify(body.evidenceItems)
      ),
      maxTokens: 2500,
      retries: 2
    });
    return ok(verifySummaryResponseSchema.parse(data));
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'Failed to verify summary.', 500, 'VERIFY_SUMMARY_FAILED');
  }
};
