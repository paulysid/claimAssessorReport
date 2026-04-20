import { callAnthropic, jsonResponse, loadPrompt, normaliseEvidenceItems, pickModel, safeParse } from './_shared.mjs';

export const handler = async (event) => {
  try {
    const payload = safeParse(event);
    const system = await loadPrompt('locate-evidence');
    const raw = await callAnthropic({
      model: pickModel(payload?.config?.modelProfile, 'light'),
      system,
      userPayload: payload,
      schemaName: 'locate-evidence-response',
      temperature: 0
    });
    raw.evidenceItems = normaliseEvidenceItems(raw.evidenceItems || []);
    return jsonResponse(200, { ok: true, data: raw });
  } catch (error) {
    return jsonResponse(500, { ok: false, error: { message: error.message } });
  }
};

export default handler;
