import test from 'node:test';
import assert from 'node:assert/strict';

import {
  decryptCurlParams,
  decryptPayload,
  encryptPayload,
  fetchKeyFromLookup,
  runSelfTest,
} from '../scripts/lib/curl-crypto-core.mjs';

const testConfig = {
  lookup: {
    url: 'https://lookup.example.com/key',
    contextHeaders: ['x-context-id'],
    clientHeaders: ['x-client'],
    deviceHeaders: ['x-device'],
    languageHeaders: ['x-language'],
    defaultHeaders: {
      client: 'web',
      device: 'desktop',
      language: 'en',
    },
    derivePositions: [2, 5, 8],
  },
  payload: {
    keyHeaders: ['x-crypto-key'],
    keySuffixHeaders: ['x-crypto-key-suffix'],
    fallbackKeys: [],
  },
  runtime: {
    preferWasm: false,
    wasmBinaryPath: '',
    wasmExecPath: '',
  },
};

test('encryptPayload and decryptPayload round-trip JSON', async () => {
  const encrypted = await encryptPayload({
    data: { foo: 'bar', count: 2 },
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
  });

  assert.equal(encrypted.ok, true);

  const decrypted = await decryptPayload({
    encryptedData: encrypted.value,
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
  });

  assert.equal(decrypted.ok, true);
  assert.deepEqual(decrypted.value, { foo: 'bar', count: 2 });
});

test('decryptCurlParams decrypts POST body data field', async () => {
  const encrypted = await encryptPayload({
    data: { uid: 7, amount: 99 },
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
  });

  const curl = `curl -X POST "https://example.com/pay" -H "Content-Type: application/json" -H "x-crypto-key: abc" -H "x-crypto-key-suffix: xyz" --data-raw '{"data":"${encrypted.value}","traceId":"t1"}'`;
  const result = await decryptCurlParams({ curlCommand: curl, autoFetchKey: false, config: testConfig });

  assert.equal(result.ok, true);
  assert.equal(result.extraction.location, 'body.data');
  assert.deepEqual(result.decryptedParams, {
    data: { uid: 7, amount: 99 },
    traceId: 't1',
  });
});

test('decryptCurlParams decrypts GET query data field', async () => {
  const encrypted = await encryptPayload({
    data: { page: 1, keyword: 'leo' },
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
  });

  const curl = `curl "https://example.com/search?data=${encodeURIComponent(encrypted.value)}&scene=test" -H "x-crypto-key: abc" -H "x-crypto-key-suffix: xyz"`;
  const result = await decryptCurlParams({ curlCommand: curl, autoFetchKey: false, config: testConfig });

  assert.equal(result.ok, true);
  assert.equal(result.extraction.location, 'query.data');
  assert.deepEqual(result.decryptedParams, {
    data: { page: 1, keyword: 'leo' },
    scene: 'test',
  });
});

test('fetchKeyFromLookup extracts key from configured lookup response', async () => {
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        success: true,
        data: '1756154950777',
      };
    },
  });

  const result = await fetchKeyFromLookup({
    contextValue: 'ctx-1',
    config: testConfig,
    fetchImpl,
  });

  assert.equal(result.ok, true);
  assert.equal(result.key, '555');
});

test('decryptPayload prefers wasm runtime when available', async () => {
  const result = await decryptPayload({
    encryptedData: 'cipher-value',
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
    wasmRuntime: {
      ok: true,
      decrypt(cipher, secretKey) {
        assert.equal(cipher, 'cipher+value');
        assert.equal(secretKey, 'abcxyz');
        return '{"source":"wasm"}';
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.strategy, 'wasm');
  assert.deepEqual(result.value, { source: 'wasm' });
});

test('encryptPayload prefers wasm runtime when available', async () => {
  const result = await encryptPayload({
    data: { foo: 'bar' },
    key: 'abc',
    keySuffix: 'xyz',
    config: testConfig,
    wasmRuntime: {
      ok: true,
      encrypt(message, secretKey) {
        assert.equal(message, '{"foo":"bar"}');
        assert.equal(secretKey, 'abcxyz');
        return 'cipher-from-wasm';
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.strategy, 'wasm');
  assert.equal(result.value, 'cipher-from-wasm');
});

test('runSelfTest passes', async () => {
  const result = await runSelfTest({ config: testConfig });
  assert.equal(result.ok, true);
});
