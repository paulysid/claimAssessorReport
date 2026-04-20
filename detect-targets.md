import { callAnthropic, jsonResponse, loadPrompt, pickModel, safeParse } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('extract-facts');
    const data = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'strong'),
      system,
      userPayload: payload,
      schemaName: 'extract-facts-response',
      temperature: 0
    });
    return jsonResponse(200, { ok: true, data });
  } catch (error) {
    return jsonResponse(500, { ok: false, error: { message: error.message } });
  }
};

export default handler;
