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

function stripMarkdownFences(text) {
  let value = String(text || '').trim();
  value = value.replace(/^```(?:json)?\s*/i, '');
  value = value.replace(/\s*```\s*$/i, '');
  return value.trim();
}

function extractFirstJsonObject(text) {
  const value = String(text || '');
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return value.slice(start, end + 1);
  }
  return value;
}

function parseJsonFromText(text) {
  const attempts = [
    String(text || ''),
    stripMarkdownFences(text),
    extractFirstJsonObject(stripMarkdownFences(text))
  ];
  let last;
  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBackoffDelay(attempt) {
  const base = Number(process.env.ANTHROPIC_RETRY_BASE_MS || 2000);
  const jitter = Math.floor(Math.random() * 800);
  return Math.min(base * (2 ** (attempt - 1)) + jitter, 15000);
}

function normaliseAnthropicError(responseData, response, requestId) {
  const message = responseData?.error?.message || 'Anthropic request failed.';
  const type = responseData?.error?.type || 'api_error';
  const status = response?.status || 500;
  const error = new Error(message);
  error.status = status;
  error.type = type;
  error.requestId = requestId;
  error.retryable = status === 429 || status === 500 || status === 529 || status === 504 || /overloaded/i.test(message);
  return error;
}

export function toClientError(error, fallbackMessage = 'Request failed.') {
  const status = Number(error?.status) || 500;
  const retryable = Boolean(error?.retryable);
  const requestId = error?.requestId || null;
  const message = error?.clientMessage || error?.message || fallbackMessage;
  let code = error?.code || 'REQUEST_FAILED';

  if (error?.type === 'overloaded_error' || /overloaded/i.test(error?.message || '')) {
    code = 'ANTHROPIC_OVERLOADED';
  } else if (status === 504) {
    code = 'ANTHROPIC_TIMEOUT';
  } else if (status === 429) {
    code = 'ANTHROPIC_RATE_LIMITED';
  }

  return {
    ok: false,
    error: {
      code,
      message,
      retryable,
      requestId,
      details: error?.details || null
    }
  };
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
    const requestId = response.headers.get('request-id') || response.headers.get('x-request-id') || null;
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw normaliseAnthropicError(data, response, requestId);
    }
    return {
      text: data?.content?.map((c) => c.text || '').join('\n').trim() || '',
      requestId
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Anthropic request timed out after ${timeoutMs}ms`);
      timeoutError.status = 504;
      timeoutError.type = 'timeout_error';
      timeoutError.retryable = true;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function callAnthropic({ model, system, userPayload, schemaName, temperature = 0.1, maxTokens = 3200, fallbackModel = undefined }) {
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

  const maxAttempts = Number(process.env.ANTHROPIC_MAX_RETRIES || 3);
  let lastError;
  let activeBody = baseBody;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await fetchAnthropic(activeBody, apiKey);
      debugLog('Anthropic response received', { attempt, outputChars: result.text.length, requestId: result.requestId });
      return parseJsonFromText(result.text);
    } catch (error) {
      lastError = error;
      debugLog('Anthropic request failed', { attempt, message: error.message, status: error.status, type: error.type, requestId: error.requestId });
      if (attempt >= maxAttempts) break;
      if (!error?.retryable) break;
      await sleep(buildBackoffDelay(attempt));
    }
  }

  if (fallbackModel && fallbackModel !== model) {
    debugLog('Anthropic fallback model attempt starting', { primaryModel: model, fallbackModel });
    try {
      const fallbackResult = await fetchAnthropic({ ...baseBody, model: fallbackModel }, apiKey);
      debugLog('Anthropic fallback response received', { outputChars: fallbackResult.text.length, requestId: fallbackResult.requestId, fallbackModel });
      return parseJsonFromText(fallbackResult.text);
    } catch (fallbackError) {
      lastError = fallbackError;
      debugLog('Anthropic fallback request failed', { message: fallbackError.message, status: fallbackError.status, type: fallbackError.type, requestId: fallbackError.requestId });
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
    const result = await fetchAnthropic(repairBody, apiKey);
    debugLog('Anthropic repair response received', { outputChars: result.text.length, requestId: result.requestId });
    return parseJsonFromText(result.text);
  } catch (repairError) {
    const finalError = repairError || lastError || new Error('Unknown Anthropic error');
    finalError.clientMessage = finalError.retryable
      ? 'The extraction service is temporarily overloaded. Please retry in a moment.'
      : `Anthropic request failed: ${finalError.message || 'Unknown error'}`;
    throw finalError;
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

export function pickFallbackModel(kind = 'extraction') {
  if (kind === 'extraction') {
    return process.env.ANTHROPIC_EXTRACTION_FALLBACK_MODEL || process.env.ANTHROPIC_ROUTING_MODEL || 'claude-haiku-4-5';
  }
  if (kind === 'verification') {
    return process.env.ANTHROPIC_VERIFICATION_FALLBACK_MODEL || process.env.ANTHROPIC_EXTRACTION_MODEL || 'claude-haiku-4-5';
  }
  return process.env.ANTHROPIC_ROUTING_MODEL || 'claude-haiku-4-5';
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
