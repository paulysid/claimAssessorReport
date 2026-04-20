import { callAnthropic, jsonResponse, loadPrompt, pickModel, safeParse } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('detect-targets');
    const data = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'light'),
      system,
      userPayload: payload,
      schemaName: 'detect-targets-response',
      temperature: 0
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    return jsonResponse(500, { ok: false, error: { message: error.message } });
  }
};

export default handler;
