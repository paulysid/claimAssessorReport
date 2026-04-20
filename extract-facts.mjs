import { jsonResponse } from './_shared.mjs';

export const handler = async () => {
  return jsonResponse(200, {
    ok: true,
    data: {
      service: 'strata-claims-extractor',
      runtime: 'netlify-functions',
      anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY)
    }
  });
};

export default handler;
