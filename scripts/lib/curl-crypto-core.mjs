import { createCipheriv, createDecipheriv } from 'node:crypto';

import { DEFAULT_CONFIG } from './config.mjs';
import { parseCurl } from './curl-parser.mjs';

function parseMaybeJson(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }

  return value;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function pickHeaderValue(headers, aliases = []) {
  for (const alias of aliases) {
    const normalizedAlias = String(alias).toLowerCase();
    if (headers[normalizedAlias]) {
      return headers[normalizedAlias];
    }
  }

  return '';
}

function normalizeCipherText(value) {
  let normalized = String(value ?? '').trim();

  try {
    const decoded = decodeURIComponent(normalized);
    if (decoded) {
      normalized = decoded;
    }
  } catch {
    // Keep the original value when it is not URL encoded.
  }

  return normalized.replace(/-/g, '+').replace(/_/g, '/');
}

function coerceInputData(value) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value);
}

function toAesKey(secretKey) {
  return Buffer.from(String(secretKey).padEnd(16, '0').slice(0, 16), 'utf8');
}

function decodeBase64(value) {
  const buffer = Buffer.from(value, 'base64');
  const decoded = buffer.toString('utf8');

  if (!decoded || Buffer.from(decoded, 'utf8').toString('base64').replace(/=+$/, '') === value.replace(/=+$/, '')) {
    return decoded;
  }

  return '';
}

function extractEncryptedPayload(parsedCurl) {
  if (parsedCurl.method === 'GET') {
    if (typeof parsedCurl.queryParams.data === 'string') {
      return {
        location: 'query.data',
        encryptedData: parsedCurl.queryParams.data,
        container: parsedCurl.queryParams,
        kind: Object.keys(parsedCurl.queryParams).length === 1 ? 'query-direct' : 'query-data-field',
      };
    }

    return null;
  }

  if (typeof parsedCurl.body === 'string') {
    return {
      location: 'body',
      encryptedData: parsedCurl.body,
      container: null,
      kind: 'body-direct',
    };
  }

  if (parsedCurl.body && typeof parsedCurl.body === 'object' && typeof parsedCurl.body.data === 'string') {
    return {
      location: 'body.data',
      encryptedData: parsedCurl.body.data,
      container: parsedCurl.body,
      kind: Object.keys(parsedCurl.body).length === 1 ? 'body-direct' : 'body-data-field',
    };
  }

  return null;
}

export async function fetchKeyFromLookup({
  contextValue,
  client = '',
  device = '',
  language = '',
  config = DEFAULT_CONFIG,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!contextValue) {
    return {
      ok: false,
      code: 'LOOKUP_CONTEXT_MISSING',
      message: 'A lookup context value is required to fetch a key.',
    };
  }

  if (!config.lookup.url) {
    return {
      ok: false,
      code: 'LOOKUP_URL_MISSING',
      message: 'No lookup URL is configured. Set one with a local config file, env var, or --lookup-url.',
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      code: 'FETCH_UNAVAILABLE',
      message: 'fetch is not available in this Node runtime.',
    };
  }

  const response = await fetchImpl(config.lookup.url, {
    method: 'GET',
    headers: {
      [config.lookup.contextHeaders[0]]: contextValue,
      ...(client ? { [config.lookup.clientHeaders[0]]: client } : {}),
      ...(device ? { [config.lookup.deviceHeaders[0]]: device } : {}),
      ...(language ? { [config.lookup.languageHeaders[0]]: language } : {}),
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    return {
      ok: false,
      code: 'KEY_FETCH_FAILED',
      message: 'key lookup request failed.',
      status: response.status,
      payload,
    };
  }

  if (!payload?.success || payload?.data === undefined || payload?.data === null) {
    return {
      ok: false,
      code: 'KEY_FETCH_FAILED',
      message: 'key lookup response did not contain a usable key value.',
      payload,
    };
  }

  const raw = String(payload.data);
  if (raw.length < 9) {
    return {
      ok: false,
      code: 'KEY_FORMAT_INVALID',
      message: 'key lookup response was too short to derive the key.',
      payload,
    };
  }

  return {
    ok: true,
    code: 'OK',
    key: config.lookup.derivePositions.map((index) => raw[index] ?? '').join(''),
    raw,
  };
}

export async function resolveCryptoContext({
  headers = {},
  key = '',
  keySuffix = '',
  autoFetchKey = true,
  config = DEFAULT_CONFIG,
  fetchImpl = globalThis.fetch,
} = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([headerName, value]) => [headerName.toLowerCase(), String(value)])
  );

  const resolvedKeySuffix = keySuffix || pickHeaderValue(normalizedHeaders, config.payload.keySuffixHeaders);
  const contextValue = pickHeaderValue(normalizedHeaders, config.lookup.contextHeaders);
  const client = pickHeaderValue(normalizedHeaders, config.lookup.clientHeaders) || config.lookup.defaultHeaders.client;
  const device = pickHeaderValue(normalizedHeaders, config.lookup.deviceHeaders) || config.lookup.defaultHeaders.device;
  const language =
    pickHeaderValue(normalizedHeaders, config.lookup.languageHeaders) || config.lookup.defaultHeaders.language;

  if (key) {
    return {
      ok: true,
      code: 'OK',
      key,
      keySuffix: resolvedKeySuffix,
      fullKey: resolvedKeySuffix ? `${key}${resolvedKeySuffix}` : key,
      keySource: 'explicit',
      keySuffixSource: keySuffix ? 'explicit' : resolvedKeySuffix ? 'configured-header' : 'none',
      contextValue,
    };
  }

  if (autoFetchKey && contextValue) {
    const fetched = await fetchKeyFromLookup({
      contextValue,
      client,
      device,
      language,
      config,
      fetchImpl,
    });

    if (fetched.ok) {
      return {
        ok: true,
        code: 'OK',
        key: fetched.key,
        keySuffix: resolvedKeySuffix,
        fullKey: resolvedKeySuffix ? `${fetched.key}${resolvedKeySuffix}` : fetched.key,
        keySource: 'lookup-api',
        keySuffixSource: resolvedKeySuffix ? 'configured-header' : 'none',
        contextValue,
        rawKeyResponse: fetched.raw,
      };
    }
  }

  const headerKey = pickHeaderValue(normalizedHeaders, config.payload.keyHeaders);

  if (!headerKey) {
    return {
      ok: false,
      code: 'KEY_MISSING',
      message: 'No decryption key was provided and no usable key could be derived from the configured headers.',
      keySuffix: resolvedKeySuffix,
      contextValue,
    };
  }

  return {
    ok: true,
    code: 'OK',
    key: headerKey,
    keySuffix: resolvedKeySuffix,
    fullKey: resolvedKeySuffix ? `${headerKey}${resolvedKeySuffix}` : headerKey,
    keySource: 'configured-header',
    keySuffixSource: resolvedKeySuffix ? 'configured-header' : 'none',
    contextValue,
  };
}

export function decryptPayload({
  encryptedData,
  key = '',
  keySuffix = '',
  config = DEFAULT_CONFIG,
} = {}) {
  const original = String(encryptedData ?? '');
  const normalized = normalizeCipherText(original);
  const directParse = parseMaybeJson(original);

  if (typeof directParse !== 'string') {
    return {
      ok: true,
      code: 'OK',
      strategy: 'plain-json',
      value: directParse,
      normalizedInput: normalized,
    };
  }

  const fullKey = keySuffix ? `${key}${keySuffix}` : key;
  const candidates = dedupe([fullKey, key, ...(config.payload.fallbackKeys ?? [])]);

  for (const secretKey of candidates) {
    try {
      const aesKey = toAesKey(secretKey);
      const decipher = createDecipheriv('aes-128-cbc', aesKey, aesKey);
      let decrypted = decipher.update(normalized, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      if (!decrypted) {
        continue;
      }

      return {
        ok: true,
        code: 'OK',
        strategy: 'aes-128-cbc',
        value: parseMaybeJson(decrypted),
        normalizedInput: normalized,
        fullKey,
      };
    } catch {
      // Try the next candidate key.
    }
  }

  try {
    const decoded = decodeBase64(normalized);
    if (decoded && decoded !== normalized) {
      return {
        ok: true,
        code: 'OK',
        strategy: 'base64',
        value: parseMaybeJson(decoded),
        normalizedInput: normalized,
        fullKey,
      };
    }
  } catch {
    // Ignore and return a structured failure below.
  }

  return {
    ok: false,
    code: 'DECRYPT_FAILED',
    message: 'Unable to decrypt the payload with the provided key material.',
    value: original,
    normalizedInput: normalized,
    fullKey,
  };
}

export function encryptPayload({
  data,
  key = '',
  keySuffix = '',
  config = DEFAULT_CONFIG,
} = {}) {
  const fullKey = keySuffix ? `${key}${keySuffix}` : key;
  const fallbackKey = config.payload.fallbackKeys?.[0] ?? '';
  const effectiveKey = fullKey || fallbackKey;
  if (!effectiveKey) {
    return {
      ok: false,
      code: 'KEY_MISSING',
      message: 'A key is required to encrypt data.',
    };
  }

  const aesKey = toAesKey(effectiveKey);
  const cipher = createCipheriv('aes-128-cbc', aesKey, aesKey);
  let encrypted = cipher.update(coerceInputData(data), 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return {
    ok: true,
    code: 'OK',
    value: encrypted,
    fullKey: effectiveKey,
  };
}

function mergeDecryptedResult(extraction, decryptedValue) {
  if (extraction.kind === 'query-data-field' || extraction.kind === 'body-data-field') {
    return {
      ...extraction.container,
      data: decryptedValue,
    };
  }

  return decryptedValue;
}

export async function decryptCurlParams({
  curlCommand,
  key = '',
  keySuffix = '',
  autoFetchKey = true,
  config = DEFAULT_CONFIG,
  fetchImpl = globalThis.fetch,
} = {}) {
  const parsedCurl = parseCurl(curlCommand);
  const extraction = extractEncryptedPayload(parsedCurl);

  if (!extraction) {
    return {
      ok: false,
      code: 'NO_ENCRYPTED_PAYLOAD',
      message: 'No encrypted request payload was found in the curl command.',
      curl: parsedCurl,
    };
  }

  const context = await resolveCryptoContext({
    headers: parsedCurl.headers,
    key,
    keySuffix,
    autoFetchKey,
    config,
    fetchImpl,
  });

  if (!context.ok) {
    return {
      ...context,
      curl: parsedCurl,
      extraction,
    };
  }

  const decrypted = decryptPayload({
    encryptedData: extraction.encryptedData,
    key: context.key,
    keySuffix: context.keySuffix,
    config,
  });

  if (!decrypted.ok) {
    return {
      ...decrypted,
      curl: parsedCurl,
      extraction,
      context,
    };
  }

  return {
    ok: true,
    code: 'OK',
    curl: parsedCurl,
    extraction: {
      location: extraction.location,
      encryptedData: extraction.encryptedData,
    },
    context,
    decryptedParams: mergeDecryptedResult(extraction, decrypted.value),
    strategy: decrypted.strategy,
  };
}

export function runSelfTest() {
  const sample = {
    uid: 42,
    action: 'ping',
  };

  const encrypted = encryptPayload({
    data: sample,
    key: 'abc',
    keySuffix: 'xyz',
    config: DEFAULT_CONFIG,
  });

  if (!encrypted.ok) {
    return encrypted;
  }

  const decrypted = decryptPayload({
    encryptedData: encrypted.value,
    key: 'abc',
    keySuffix: 'xyz',
    config: DEFAULT_CONFIG,
  });

  if (!decrypted.ok || JSON.stringify(decrypted.value) !== JSON.stringify(sample)) {
    return {
      ok: false,
      code: 'SELF_TEST_FAILED',
      message: 'curl-crypto self-test failed.',
      encrypted,
      decrypted,
    };
  }

  return {
    ok: true,
    code: 'OK',
    message: 'curl-crypto encryption and decryption are working.',
    sample,
  };
}
