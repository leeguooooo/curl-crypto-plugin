import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadRuntimeConfig, writeRuntimeConfig } from '../scripts/lib/config.mjs';

test('loadRuntimeConfig reads a local config file and env overrides', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-config-'));
  const configPath = path.join(dir, 'config.json');

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

  const loaded = await loadRuntimeConfig({
    configPath,
    env: {
      CURL_CRYPTO_KEY_SUFFIX_HEADERS: 'x-crypto-key-suffix',
    },
  });

  assert.equal(loaded.exists, true);
  assert.equal(loaded.config.lookup.url, 'https://lookup.example.com/key');
  assert.deepEqual(loaded.config.lookup.contextHeaders, ['x-context-id']);
  assert.deepEqual(loaded.config.payload.keyHeaders, ['x-crypto-key']);
  assert.deepEqual(loaded.config.payload.keySuffixHeaders, ['x-crypto-key-suffix']);
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
    },
    { configPath }
  );

  assert.equal(saved.configPath, configPath);
  assert.deepEqual(saved.config.lookup.contextHeaders, ['x-context-id']);
  assert.deepEqual(saved.config.payload.keyHeaders, ['x-crypto-key']);
  assert.deepEqual(saved.config.payload.keySuffixHeaders, ['x-crypto-key-suffix']);
});
