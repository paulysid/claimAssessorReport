import { callAnthropic, jsonResponse, loadPrompt, pickFallbackModel, pickModel, safeParse, toClientError } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('detect-targets');
    const data = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'light'),
      fallbackModel: pickFallbackModel('routing'),
      system,
      userPayload: payload,
      schemaName: 'detect-targets-response',
      temperature: 0
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    const clientError = toClientError(error, 'The target detection step failed.');
    const status = clientError.error.retryable ? 503 : 500;
    return jsonResponse(status, clientError);
  }
};

export default handler;
