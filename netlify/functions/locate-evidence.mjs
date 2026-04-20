import { callAnthropic, jsonResponse, loadPrompt, pickFallbackModel, pickModel, safeParse, toClientError } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('locate-evidence');
    const data = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'light'),
      fallbackModel: pickFallbackModel('routing'),
      system,
      userPayload: payload,
      schemaName: 'locate-evidence-response',
      temperature: 0
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    const clientError = toClientError(error, 'The evidence location step failed.');
    const status = clientError.error.retryable ? 503 : 500;
    return jsonResponse(status, clientError);
  }
};

export default handler;
