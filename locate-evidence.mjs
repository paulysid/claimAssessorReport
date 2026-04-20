import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

function resolveAssetPath(...parts) {
  return join(process.cwd(), ...parts);
}

export function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

export async function loadPrompt(name) {
  const path = resolveAssetPath('netlify', 'functions', '_assets', 'prompts', `${name}.md`);
  try {
    return await readFile(path, 'utf8');
  } catch (err) {
    throw new Error(`Prompt asset not found: ${path}`);
  }
}

export async function loadSchema(name) {
  const path = resolveAssetPath('netlify', 'functions', '_assets', 'schemas', `${name}.json`);
  try {
    const text = await readFile(path, 'utf8');
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Schema asset not found or invalid JSON: ${path}`);
  }
}

export function safeParse(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    throw new Error('Request body was not valid JSON.');
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function debugEnabled() {
  return String(process.env.ENABLE_DEBUG_LOGS || 'false').toLowerCase() === 'true';
}

function debugLog(message, meta = undefined) {
  if (!debugEnabled()) return;
  if (meta === undefined) {
    console.log(`[debug] ${message}`);
  } else {
    console.log(`[debug] ${message}`, meta);
  }
}

function parseJsonFromText(text) {
  try {
    return JSON.parse(text);
  } catch {
    const fenced = text.match(/```json\s*([\s\S]*?)```/i)?.[1] || text;
    return JSON.parse(fenced);
  }
}

async function fetchAnthropic(body, apiKey) {
  const controller = new AbortController();
  const timeoutMs = Number(process.env.ANTHROPIC_TIMEOUT_MS || 45000);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || 'Anthropic request failed.');
    }
    return data?.content?.map((c) => c.text || '').join('\n').trim() || '';
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAnthropic({ model, system, userPayload, schemaName, temperature = 0.1, maxTokens = 3200 }) {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const schema = await loadSchema(schemaName);
  const inputText = JSON.stringify({ schema, input: userPayload }, null, 2);
  const baseBody = {
    model,
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: inputText
          }
        ]
      }
    ]
  };

  debugLog('Anthropic request prepared', { model, schemaName, inputChars: inputText.length, maxTokens });

  const maxAttempts = 2;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const text = await fetchAnthropic(baseBody, apiKey);
      debugLog('Anthropic response received', { attempt, outputChars: text.length });
      return parseJsonFromText(text);
    } catch (error) {
      lastError = error;
      debugLog('Anthropic request failed', { attempt, message: error.message });
      if (attempt >= maxAttempts) break;
    }
  }

  const repairBody = {
    ...baseBody,
    messages: [
      ...baseBody.messages,
      {
        role: 'assistant',
        content: [{ type: 'text', text: 'The previous response was invalid or could not be parsed.' }]
      },
      {
        role: 'user',
        content: [{
          type: 'text',
          text: 'Return the same answer again, but output valid JSON only, match the schema exactly, add no commentary, omit no required fields, and do not change the factual content except where necessary to comply with the schema.'
        }]
      }
    ]
  };

  try {
    const text = await fetchAnthropic(repairBody, apiKey);
    debugLog('Anthropic repair response received', { outputChars: text.length });
    return parseJsonFromText(text);
  } catch (repairError) {
    throw new Error(`Anthropic request failed: ${repairError.message || lastError?.message || 'Unknown error'}`);
  }
}

export function pickModel(profile = 'balanced', tier = 'strong') {
  const specificEnv = {
    light: process.env.ANTHROPIC_ROUTING_MODEL,
    strong: tier === 'strong' ? process.env.ANTHROPIC_EXTRACTION_MODEL || process.env.ANTHROPIC_VERIFICATION_MODEL : undefined
  };
  if (specificEnv[tier]) return specificEnv[tier];

  const custom = process.env.ANTHROPIC_MODEL_ROUTING_JSON;
  if (custom) {
    try {
      const routing = JSON.parse(custom);
      if (routing?.[profile]?.[tier]) return routing[profile][tier];
    } catch {
      // ignore bad env override
    }
  }
  const defaults = {
    balanced: {
      light: 'claude-haiku-4-5',
      strong: 'claude-sonnet-4-6'
    },
    higher_accuracy: {
      light: 'claude-sonnet-4-6',
      strong: 'claude-sonnet-4-6'
    },
    lower_cost: {
      light: 'claude-haiku-4-5',
      strong: 'claude-haiku-4-5'
    }
  };
  return defaults[profile]?.[tier] || defaults.balanced[tier];
}

export function normaliseEvidenceItems(items = []) {
  return items.map((item, idx) => ({
    evidenceId: item.evidenceId || `e-${String(idx + 1).padStart(4, '0')}`,
    pageStart: Number(item.pageStart || 1),
    pageEnd: Number(item.pageEnd || item.pageStart || 1),
    summary: item.summary || '',
    rawSnippet: item.rawSnippet || '',
    appliesTo: Array.isArray(item.appliesTo) ? item.appliesTo : [],
    explicitness: item.explicitness || 'explicit',
    confidence: item.confidence || 'medium',
    included: item.included !== false
  }));
}
