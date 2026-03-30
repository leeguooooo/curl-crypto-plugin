import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  getDefaultRuntimeBundlePath,
  loadRuntimeConfig,
  writeRuntimeConfig,
} from '../scripts/lib/config.mjs';
import { writeRuntimeBundle } from '../scripts/lib/runtime-bundle.mjs';

test('loadRuntimeConfig reads a local config file and env overrides', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-config-'));
  const configPath = path.join(dir, 'config.json');
  const wasmPath = path.join(dir, 'mimlib.wasm');

  await writeFile(
    configPath,
    JSON.stringify({
      lookup: {
        url: 'https://lookup.example.com/key',
        contextHeaders: ['x-context-id'],
      },
      payload: {
        keyHeaders: ['x-crypto-key'],
      },
    }),
    'utf8'
  );
  await writeFile(wasmPath, 'wasm-placeholder', 'utf8');

  const loaded = await loadRuntimeConfig({
    configPath,
    env: {
      CURL_CRYPTO_KEY_SUFFIX_HEADERS: 'x-crypto-key-suffix',
      CURL_CRYPTO_WASM_BINARY: '/private/mimlib.wasm',
      CURL_CRYPTO_RUNTIME_BUNDLE: path.join(dir, 'missing-runtime.dat'),
    },
  });

  assert.equal(loaded.exists, true);
  assert.equal(loaded.config.lookup.url, 'https://lookup.example.com/key');
  assert.deepEqual(loaded.config.lookup.contextHeaders, ['x-context-id']);
  assert.deepEqual(loaded.config.payload.keyHeaders, ['x-crypto-key']);
  assert.deepEqual(loaded.config.payload.keySuffixHeaders, ['x-crypto-key-suffix']);
  assert.equal(loaded.config.runtime.wasmBinaryPath, '/private/mimlib.wasm');
  assert.equal(loaded.runtimeReady, false);
  assert.equal(loaded.runtimeFiles.configExists, true);
  assert.equal(loaded.runtimeFiles.wasmExists, false);
  assert.equal(loaded.runtimeFiles.wasmPath, '/private/mimlib.wasm');
});

test('writeRuntimeConfig persists normalized config', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-write-'));
  const configPath = path.join(dir, 'config.json');

  const saved = await writeRuntimeConfig(
    {
      lookup: {
        url: 'https://lookup.example.com/key',
        contextHeaders: [' x-context-id '],
      },
      payload: {
        keyHeaders: [' x-crypto-key '],
        keySuffixHeaders: [' x-crypto-key-suffix '],
      },
      runtime: {
        preferWasm: true,
        wasmBinaryPath: ' /private/mimlib.wasm ',
      },
    },
    { configPath }
  );

  assert.equal(saved.configPath, configPath);
  assert.deepEqual(saved.config.lookup.contextHeaders, ['x-context-id']);
  assert.deepEqual(saved.config.payload.keyHeaders, ['x-crypto-key']);
  assert.deepEqual(saved.config.payload.keySuffixHeaders, ['x-crypto-key-suffix']);
  assert.equal(saved.config.runtime.preferWasm, true);
  assert.equal(saved.config.runtime.wasmBinaryPath, '/private/mimlib.wasm');
});

test('loadRuntimeConfig bootstraps local runtime from a bundle when files are missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-bundle-'));
  const sourceConfigPath = path.join(dir, 'source-config.json');
  const sourceWasmPath = path.join(dir, 'source-mimlib.wasm');
  const bundlePath = path.join(dir, 'runtime.dat');
  const targetConfigPath = path.join(dir, 'runtime', 'config.json');

  await writeFile(
    sourceConfigPath,
    JSON.stringify({
      lookup: {
        url: 'https://lookup.example.com/key',
      },
    }),
    'utf8'
  );
  await writeFile(sourceWasmPath, Buffer.from('wasm-bytes'), 'utf8');

  await writeRuntimeBundle({
    configPath: sourceConfigPath,
    wasmPath: sourceWasmPath,
    outputPath: bundlePath,
  });

  const loaded = await loadRuntimeConfig({
    configPath: targetConfigPath,
    env: {
      CURL_CRYPTO_RUNTIME_BUNDLE: bundlePath,
    },
  });

  const extractedConfig = JSON.parse(await readFile(targetConfigPath, 'utf8'));
  const extractedWasm = await readFile(path.join(path.dirname(targetConfigPath), 'mimlib.wasm'), 'utf8');

  assert.equal(loaded.bootstrapped, true);
  assert.equal(loaded.exists, true);
  assert.equal(loaded.runtimeReady, true);
  assert.equal(extractedConfig.lookup.url, 'https://lookup.example.com/key');
  assert.equal(extractedConfig.runtime.wasmBinaryPath, '');
  assert.equal(extractedWasm, 'wasm-bytes');
  assert.equal(loaded.config.runtime.wasmBinaryPath, path.join(path.dirname(targetConfigPath), 'mimlib.wasm'));
});

test('loadRuntimeConfig reports missing private runtime when no bundle is available', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-missing-runtime-'));
  const configPath = path.join(dir, 'config.json');

  const loaded = await loadRuntimeConfig({
    configPath,
    env: {
      CURL_CRYPTO_RUNTIME_BUNDLE: path.join(dir, 'missing-runtime.dat'),
    },
  });

  assert.equal(loaded.exists, false);
  assert.equal(loaded.runtimeReady, false);
  assert.equal(loaded.runtimeBundleExists, false);
  assert.equal(loaded.runtimeFiles.configExists, false);
  assert.equal(loaded.runtimeFiles.wasmExists, false);
});

test('loadRuntimeConfig defaults runtime bundle path to the user config directory', async () => {
  const loaded = await loadRuntimeConfig({
    env: {},
  });

  assert.equal(loaded.runtimeBundlePath, getDefaultRuntimeBundlePath());
});
