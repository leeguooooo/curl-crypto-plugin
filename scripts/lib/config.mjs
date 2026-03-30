import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export const DEFAULT_CONFIG = {
  lookup: {
    url: '',
    contextHeaders: ['context-id'],
    clientHeaders: ['client'],
    deviceHeaders: ['device'],
    languageHeaders: ['language'],
    defaultHeaders: {
      client: '',
      device: '',
      language: '',
    },
    derivePositions: [2, 5, 8],
  },
  payload: {
    keyHeaders: ['x-crypto-key'],
    keySuffixHeaders: ['x-crypto-key-suffix'],
    fallbackKeys: [],
  },
};

function normalizeStringArray(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value
    .map((entry) => String(entry).trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : [...fallback];
}

function normalizeNumberArray(value, fallback) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const normalized = value
    .map((entry) => Number.parseInt(entry, 10))
    .filter((entry) => Number.isInteger(entry) && entry >= 0);

  return normalized.length > 0 ? normalized : [...fallback];
}

export function getDefaultConfigPath() {
  return path.join(homedir(), '.config', 'curl-crypto', 'config.json');
}

export function mergeRuntimeConfig(baseConfig = DEFAULT_CONFIG, overrideConfig = {}) {
  return normalizeRuntimeConfig({
    lookup: {
      ...(baseConfig.lookup ?? {}),
      ...(overrideConfig.lookup ?? {}),
      defaultHeaders: {
        ...(baseConfig.lookup?.defaultHeaders ?? {}),
        ...(overrideConfig.lookup?.defaultHeaders ?? {}),
      },
    },
    payload: {
      ...(baseConfig.payload ?? {}),
      ...(overrideConfig.payload ?? {}),
    },
  });
}

export function normalizeRuntimeConfig(config = {}) {
  const lookup = config.lookup ?? {};
  const payload = config.payload ?? {};

  return {
    lookup: {
      url: typeof lookup.url === 'string' ? lookup.url.trim() : DEFAULT_CONFIG.lookup.url,
      contextHeaders: normalizeStringArray(lookup.contextHeaders, DEFAULT_CONFIG.lookup.contextHeaders),
      clientHeaders: normalizeStringArray(lookup.clientHeaders, DEFAULT_CONFIG.lookup.clientHeaders),
      deviceHeaders: normalizeStringArray(lookup.deviceHeaders, DEFAULT_CONFIG.lookup.deviceHeaders),
      languageHeaders: normalizeStringArray(lookup.languageHeaders, DEFAULT_CONFIG.lookup.languageHeaders),
      defaultHeaders: {
        client:
          typeof lookup.defaultHeaders?.client === 'string'
            ? lookup.defaultHeaders.client.trim()
            : DEFAULT_CONFIG.lookup.defaultHeaders.client,
        device:
          typeof lookup.defaultHeaders?.device === 'string'
            ? lookup.defaultHeaders.device.trim()
            : DEFAULT_CONFIG.lookup.defaultHeaders.device,
        language:
          typeof lookup.defaultHeaders?.language === 'string'
            ? lookup.defaultHeaders.language.trim()
            : DEFAULT_CONFIG.lookup.defaultHeaders.language,
      },
      derivePositions: normalizeNumberArray(lookup.derivePositions, DEFAULT_CONFIG.lookup.derivePositions),
    },
    payload: {
      keyHeaders: normalizeStringArray(payload.keyHeaders, DEFAULT_CONFIG.payload.keyHeaders),
      keySuffixHeaders: normalizeStringArray(
        payload.keySuffixHeaders,
        DEFAULT_CONFIG.payload.keySuffixHeaders
      ),
      fallbackKeys: normalizeStringArray(payload.fallbackKeys, DEFAULT_CONFIG.payload.fallbackKeys),
    },
  };
}

export async function loadRuntimeConfig({ configPath, env = process.env } = {}) {
  const resolvedConfigPath = configPath || env.CURL_CRYPTO_CONFIG || getDefaultConfigPath();
  let fileConfig = {};
  let exists = false;

  try {
    const raw = await readFile(resolvedConfigPath, 'utf8');
    fileConfig = JSON.parse(raw);
    exists = true;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  const envConfig = {};

  if (env.CURL_CRYPTO_LOOKUP_URL) {
    envConfig.lookup = { ...(envConfig.lookup ?? {}), url: env.CURL_CRYPTO_LOOKUP_URL };
  }
  if (env.CURL_CRYPTO_CONTEXT_HEADERS) {
    envConfig.lookup = { ...(envConfig.lookup ?? {}), contextHeaders: env.CURL_CRYPTO_CONTEXT_HEADERS.split(',') };
  }
  if (env.CURL_CRYPTO_CLIENT_HEADERS) {
    envConfig.lookup = { ...(envConfig.lookup ?? {}), clientHeaders: env.CURL_CRYPTO_CLIENT_HEADERS.split(',') };
  }
  if (env.CURL_CRYPTO_DEVICE_HEADERS) {
    envConfig.lookup = { ...(envConfig.lookup ?? {}), deviceHeaders: env.CURL_CRYPTO_DEVICE_HEADERS.split(',') };
  }
  if (env.CURL_CRYPTO_LANGUAGE_HEADERS) {
    envConfig.lookup = { ...(envConfig.lookup ?? {}), languageHeaders: env.CURL_CRYPTO_LANGUAGE_HEADERS.split(',') };
  }
  if (env.CURL_CRYPTO_DEFAULT_CLIENT || env.CURL_CRYPTO_DEFAULT_DEVICE || env.CURL_CRYPTO_DEFAULT_LANGUAGE) {
    envConfig.lookup = {
      ...(envConfig.lookup ?? {}),
      defaultHeaders: {
        client: env.CURL_CRYPTO_DEFAULT_CLIENT ?? '',
        device: env.CURL_CRYPTO_DEFAULT_DEVICE ?? '',
        language: env.CURL_CRYPTO_DEFAULT_LANGUAGE ?? '',
      },
    };
  }
  if (env.CURL_CRYPTO_DERIVE_POSITIONS) {
    envConfig.lookup = {
      ...(envConfig.lookup ?? {}),
      derivePositions: env.CURL_CRYPTO_DERIVE_POSITIONS.split(','),
    };
  }
  if (env.CURL_CRYPTO_KEY_HEADERS) {
    envConfig.payload = { ...(envConfig.payload ?? {}), keyHeaders: env.CURL_CRYPTO_KEY_HEADERS.split(',') };
  }
  if (env.CURL_CRYPTO_KEY_SUFFIX_HEADERS) {
    envConfig.payload = {
      ...(envConfig.payload ?? {}),
      keySuffixHeaders: env.CURL_CRYPTO_KEY_SUFFIX_HEADERS.split(','),
    };
  }
  if (env.CURL_CRYPTO_FALLBACK_KEYS) {
    envConfig.payload = { ...(envConfig.payload ?? {}), fallbackKeys: env.CURL_CRYPTO_FALLBACK_KEYS.split(',') };
  }

  return {
    configPath: resolvedConfigPath,
    exists,
    config: mergeRuntimeConfig(mergeRuntimeConfig(DEFAULT_CONFIG, fileConfig), envConfig),
  };
}

export async function writeRuntimeConfig(config, { configPath } = {}) {
  const resolvedConfigPath = configPath || getDefaultConfigPath();
  await mkdir(path.dirname(resolvedConfigPath), { recursive: true });
  const normalized = normalizeRuntimeConfig(config);
  await writeFile(resolvedConfigPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');

  return {
    configPath: resolvedConfigPath,
    config: normalized,
  };
}
