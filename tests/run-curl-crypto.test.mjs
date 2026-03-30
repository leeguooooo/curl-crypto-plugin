import test from 'node:test';
import assert from 'node:assert/strict';

import { runCurlCrypto, setupCurlCrypto } from '../scripts/run-curl-crypto.mjs';

test('runCurlCrypto returns stdout when command succeeds', async () => {
  const ensureCurlCrypto = async () => ({ ok: true, code: 'OK', autoInstalled: false, cliPath: '/usr/local/bin/curl-crypto' });
  const exec = async (command, args = []) => {
    assert.equal(command, '/usr/local/bin/curl-crypto');
    assert.deepEqual(args, ['self-test']);
    return { code: 0, stdout: '{"ok":true}\n', stderr: '' };
  };

  const result = await runCurlCrypto({ args: ['self-test'], ensureCurlCrypto, exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.match(result.stdout, /"ok":true/);
});

test('runCurlCrypto returns command failure for errors', async () => {
  const ensureCurlCrypto = async () => ({ ok: true, code: 'OK', autoInstalled: false, cliPath: '/usr/local/bin/curl-crypto' });
  const exec = async () => {
    const error = new Error('unknown failure');
    error.code = 2;
    error.stdout = '';
    error.stderr = 'unknown failure';
    throw error;
  };

  const result = await runCurlCrypto({ args: ['decrypt-curl'], ensureCurlCrypto, exec });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'COMMAND_FAILED');
  assert.equal(result.exitCode, 2);
});

test('setupCurlCrypto runs self-test after ensure', async () => {
  const ensureCurlCrypto = async () => ({ ok: true, code: 'OK', autoInstalled: true, cliPath: '/usr/local/bin/curl-crypto' });
  const exec = async (command, args = []) => {
    assert.equal(command, '/usr/local/bin/curl-crypto');
    assert.deepEqual(args, ['self-test']);
    return { code: 0, stdout: '{"ok":true,"message":"curl-crypto encryption and decryption are working."}', stderr: '' };
  };

  const result = await setupCurlCrypto({ ensureCurlCrypto, exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.match(result.message, /installed/);
});
