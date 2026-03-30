import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { getDefaultWasmBinaryPath } from './config.mjs';

const BUNDLED_WASM_EXEC_PATH = fileURLToPath(new URL('../../vendor/wasm/wasm_exec.js', import.meta.url));

const runtimeCache = new Map();

function createStorageShim() {
  const store = new Map();

  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
  };
}

function ensureBrowserLikeGlobals() {
  if (!globalThis.window) {
    globalThis.window = globalThis;
  }

  if (!globalThis.self) {
    globalThis.self = globalThis;
  }

  if (!globalThis.document) {
    globalThis.document = {
      cookie: '',
      createElement() {
        return {
          style: {},
          setAttribute() {},
          appendChild() {},
          remove() {},
          addEventListener() {},
          removeEventListener() {},
        };
      },
      head: { appendChild() {} },
      body: { appendChild() {} },
      querySelector() {
        return null;
      },
      getElementById() {
        return null;
      },
    };
  }

  if (!globalThis.location) {
    globalThis.location = {
      href: 'https://localhost/',
      origin: 'https://localhost',
    };
  }

  if (!globalThis.localStorage) {
    globalThis.localStorage = createStorageShim();
  }

  if (!globalThis.sessionStorage) {
    globalThis.sessionStorage = createStorageShim();
  }

  if (typeof globalThis.atob !== 'function') {
    globalThis.atob = (value) => Buffer.from(value, 'base64').toString('binary');
  }

  if (typeof globalThis.btoa !== 'function') {
    globalThis.btoa = (value) => Buffer.from(value, 'binary').toString('base64');
  }
}

async function ensureGoRuntime(execPath) {
  if (typeof globalThis.Go === 'function') {
    return;
  }

  const source = await readFile(execPath, 'utf8');
  vm.runInThisContext(source, { filename: execPath });
}

async function waitForCryptoExports(timeoutMs = 2000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (typeof globalThis.decrypt === 'function' && typeof globalThis.encrypt === 'function') {
      return {
        decrypt: globalThis.decrypt,
        encrypt: globalThis.encrypt,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  throw new Error('Timed out waiting for wasm encrypt/decrypt exports.');
}

function resolveRuntimePaths(config = {}) {
  return {
    preferWasm: config.runtime?.preferWasm !== false,
    execPath: config.runtime?.wasmExecPath || BUNDLED_WASM_EXEC_PATH,
    binaryPath: config.runtime?.wasmBinaryPath || getDefaultWasmBinaryPath(),
  };
}

async function createRuntime({ execPath, binaryPath }) {
  ensureBrowserLikeGlobals();
  await access(binaryPath);
  await access(execPath);
  await ensureGoRuntime(execPath);

  const go = new globalThis.Go();
  const bytes = await readFile(binaryPath);
  const result = await WebAssembly.instantiate(bytes, go.importObject);
  const runPromise = Promise.resolve(go.run(result.instance)).catch(() => {
    // Keep the initial load usable even if the Go runtime exits later.
  });
  const exports = await waitForCryptoExports();

  return {
    ok: true,
    code: 'OK',
    execPath,
    binaryPath,
    runPromise,
    decrypt: exports.decrypt,
    encrypt: exports.encrypt,
  };
}

export async function getWasmRuntime({ config = {} } = {}) {
  const runtimePaths = resolveRuntimePaths(config);

  if (!runtimePaths.preferWasm) {
    return {
      ok: false,
      code: 'WASM_DISABLED',
      message: 'The wasm crypto runtime is disabled by configuration.',
    };
  }

  if (!runtimePaths.binaryPath) {
    return {
      ok: false,
      code: 'WASM_BINARY_MISSING',
      message: 'No wasm binary path is configured.',
    };
  }

  const cacheKey = `${runtimePaths.execPath}::${runtimePaths.binaryPath}`;

  if (!runtimeCache.has(cacheKey)) {
    runtimeCache.set(cacheKey, createRuntime(runtimePaths));
  }

  try {
    return await runtimeCache.get(cacheKey);
  } catch (error) {
    runtimeCache.delete(cacheKey);

    return {
      ok: false,
      code: 'WASM_RUNTIME_LOAD_FAILED',
      message: error.message || 'Failed to initialize the wasm crypto runtime.',
      execPath: runtimePaths.execPath,
      binaryPath: runtimePaths.binaryPath,
    };
  }
}
