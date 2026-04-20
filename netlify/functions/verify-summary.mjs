import { callAnthropic, jsonResponse, loadPrompt, pickFallbackModel, pickModel, safeParse, toClientError } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('verify-summary');
    const data = await callAnthropic({
      model: process.env.ANTHROPIC_VERIFICATION_MODEL || pickModel(payload?.config?.modelProfile, 'strong'),
      fallbackModel: pickFallbackModel('verification'),
      system,
      userPayload: payload,
      schemaName: 'verify-summary-response',
      temperature: 0
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    const clientError = toClientError(error, 'The verification step failed.');
    const status = clientError.error.retryable ? 503 : 500;
    return jsonResponse(status, clientError);
  }
};

export default handler;
