import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { BUNDLED_RUNTIME_PATH, extractRuntimeBundle } from './runtime-bundle.mjs';

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
  runtime: {
    preferWasm: true,
    wasmBinaryPath: '',
    wasmExecPath: '',
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

export function getDefaultWasmBinaryPath() {
  return path.join(homedir(), '.config', 'curl-crypto', 'mimlib.wasm');
}

export function getDefaultRuntimeDir() {
  return path.dirname(getDefaultConfigPath());
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
    runtime: {
      ...(baseConfig.runtime ?? {}),
      ...(overrideConfig.runtime ?? {}),
    },
  });
}

export function normalizeRuntimeConfig(config = {}) {
  const lookup = config.lookup ?? {};
  const payload = config.payload ?? {};
  const runtime = config.runtime ?? {};

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
    runtime: {
      preferWasm: typeof runtime.preferWasm === 'boolean' ? runtime.preferWasm : DEFAULT_CONFIG.runtime.preferWasm,
      wasmBinaryPath:
        typeof runtime.wasmBinaryPath === 'string'
          ? runtime.wasmBinaryPath.trim()
          : DEFAULT_CONFIG.runtime.wasmBinaryPath,
      wasmExecPath:
        typeof runtime.wasmExecPath === 'string'
          ? runtime.wasmExecPath.trim()
          : DEFAULT_CONFIG.runtime.wasmExecPath,
    },
  };
}

export async function loadRuntimeConfig({ configPath, env = process.env } = {}) {
  const resolvedConfigPath = configPath || env.CURL_CRYPTO_CONFIG || getDefaultConfigPath();
  const runtimeDir = path.dirname(resolvedConfigPath);
  const resolvedWasmPath = env.CURL_CRYPTO_WASM_BINARY || path.join(runtimeDir, 'mimlib.wasm');
  const resolvedBundlePath = env.CURL_CRYPTO_RUNTIME_BUNDLE || BUNDLED_RUNTIME_PATH;

  let bootstrapped = false;
  let configFileReady = false;
  let wasmFileReady = false;
  let bundleExists = false;
  try {
    await access(resolvedConfigPath);
    configFileReady = true;
  } catch {
    // Continue below.
  }

  try {
    await access(resolvedWasmPath);
    wasmFileReady = true;
  } catch {
    // Continue below.
  }

  if (!configFileReady || !wasmFileReady) {
    try {
      await access(resolvedBundlePath);
      bundleExists = true;
      await extractRuntimeBundle({
        bundlePath: resolvedBundlePath,
        targetDir: runtimeDir,
      });
      bootstrapped = true;
    } catch {
      // Ignore bootstrap failure here and continue with normal file loading.
    }
  }

  try {
    await access(resolvedConfigPath);
    configFileReady = true;
  } catch {
    configFileReady = false;
  }

  try {
    await access(resolvedWasmPath);
    wasmFileReady = true;
  } catch {
    wasmFileReady = false;
  }

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
  if (env.CURL_CRYPTO_PREFER_WASM) {
    envConfig.runtime = {
      ...(envConfig.runtime ?? {}),
      preferWasm: !['0', 'false', 'no', 'off'].includes(String(env.CURL_CRYPTO_PREFER_WASM).toLowerCase()),
    };
  }
  if (env.CURL_CRYPTO_WASM_BINARY) {
    envConfig.runtime = { ...(envConfig.runtime ?? {}), wasmBinaryPath: env.CURL_CRYPTO_WASM_BINARY };
  }
  if (env.CURL_CRYPTO_WASM_EXEC) {
    envConfig.runtime = { ...(envConfig.runtime ?? {}), wasmExecPath: env.CURL_CRYPTO_WASM_EXEC };
  }

  if (!envConfig.runtime?.wasmBinaryPath) {
    envConfig.runtime = {
      ...(envConfig.runtime ?? {}),
      wasmBinaryPath: resolvedWasmPath,
    };
  }

  return {
    configPath: resolvedConfigPath,
    exists,
    bootstrapped,
    runtimeReady: configFileReady && wasmFileReady,
    runtimeDir,
    runtimeBundlePath: resolvedBundlePath,
    runtimeBundleExists: bundleExists,
    runtimeFiles: {
      configPath: resolvedConfigPath,
      configExists: configFileReady,
      wasmPath: resolvedWasmPath,
      wasmExists: wasmFileReady,
    },
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
