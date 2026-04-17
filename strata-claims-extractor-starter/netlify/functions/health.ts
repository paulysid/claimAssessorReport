import type { Handler } from '@netlify/functions';
import { ok } from './_shared/http';

export const handler: Handler = async () => {
  return ok({
    ok: true,
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    timestamp: new Date().toISOString()
  });
};
