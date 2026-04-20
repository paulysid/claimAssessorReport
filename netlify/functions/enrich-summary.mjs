import { callAnthropic, jsonResponse, loadPrompt, pickFallbackModel, pickModel, safeParse, toClientError } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('enrich-summary');
    const data = await callAnthropic({
      model: process.env.ANTHROPIC_EXTRACTION_MODEL || pickModel(payload?.config?.modelProfile, 'strong'),
      fallbackModel: pickFallbackModel('extraction'),
      system,
      userPayload: payload,
      schemaName: 'summary-draft-response',
      temperature: 0.1
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    const clientError = toClientError(error, 'The summary generation step failed.');
    const status = clientError.error.retryable ? 503 : 500;
    return jsonResponse(status, clientError);
  }
};

export default handler;
