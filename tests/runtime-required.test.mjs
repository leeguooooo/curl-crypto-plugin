import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

test('self-test asks the user to contact Leo when runtime files are missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-runtime-required-'));

  try {
    await execFileAsync('node', ['bin/curl-crypto.mjs', 'self-test'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CURL_CRYPTO_CONFIG: path.join(dir, 'config.json'),
        CURL_CRYPTO_RUNTIME_BUNDLE: path.join(dir, 'missing-runtime.dat'),
      },
    });

    assert.fail('self-test should fail when the private runtime is unavailable');
  } catch (error) {
    const output = JSON.parse(error.stdout);

    assert.equal(output.ok, false);
    assert.equal(output.code, 'RUNTIME_BUNDLE_REQUIRED');
    assert.equal(output.action, 'ask_leo_for_runtime_dat');
    assert.match(output.message, /ask Leo for runtime\.dat/i);
    assert.equal(output.runtimeBundlePath, path.join(dir, 'missing-runtime.dat'));
  }
});

test('doctor reports the fixed runtime bundle path when private runtime is missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'curl-crypto-doctor-required-'));

  try {
    await execFileAsync('node', ['bin/curl-crypto.mjs', 'doctor'], {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        CURL_CRYPTO_CONFIG: path.join(dir, 'config.json'),
        CURL_CRYPTO_RUNTIME_BUNDLE: path.join(dir, 'runtime.dat'),
      },
    });

    assert.fail('doctor should fail when the private runtime is unavailable');
  } catch (error) {
    const output = JSON.parse(error.stdout);

    assert.equal(output.ok, false);
    assert.equal(output.code, 'RUNTIME_BUNDLE_REQUIRED');
    assert.equal(output.status, 'runtime_missing');
    assert.equal(output.runtimeBundlePath, path.join(dir, 'runtime.dat'));
  }
});
