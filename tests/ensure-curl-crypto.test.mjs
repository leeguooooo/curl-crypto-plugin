import test from 'node:test';
import assert from 'node:assert/strict';

import { ensureCurlCrypto } from '../scripts/ensure-curl-crypto.mjs';

function createExecStub(handlers) {
  return async (command, args = []) => {
    const key = `${command} ${args.join(' ')}`.trim();
    const handler = handlers[key];

    if (!handler) {
      throw new Error(`Unexpected command: ${key}`);
    }

    if (handler.ok) {
      return {
        command,
        args,
        code: 0,
        stdout: handler.stdout ?? '',
        stderr: handler.stderr ?? '',
      };
    }

    const error = new Error(handler.stderr ?? 'command failed');
    error.code = handler.code ?? 1;
    error.stdout = handler.stdout ?? '';
    error.stderr = handler.stderr ?? '';
    throw error;
  };
}

test('returns npm missing when npm is not available', async () => {
  const exec = createExecStub({
    'which node': { ok: true, stdout: '/usr/bin/node\n' },
    'which npm': { ok: false, stderr: 'npm missing' },
  });

  const result = await ensureCurlCrypto({ exec });

  assert.equal(result.ok, false);
  assert.equal(result.code, 'NPM_MISSING');
});

test('returns ok when curl-crypto is already installed', async () => {
  const exec = createExecStub({
    'which node': { ok: true, stdout: '/usr/bin/node\n' },
    'which npm': { ok: true, stdout: '/usr/bin/npm\n' },
    'which curl-crypto': { ok: true, stdout: '/usr/local/bin/curl-crypto\n' },
    '/usr/local/bin/curl-crypto self-test': { ok: true, stdout: '{"ok":true}\n' },
  });

  const result = await ensureCurlCrypto({ exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.autoInstalled, false);
});

test('reinstalls curl-crypto when the discovered binary is broken', async () => {
  const calls = [];
  const exec = async (command, args = []) => {
    calls.push(`${command} ${args.join(' ')}`.trim());
    const key = calls[calls.length - 1];

    if (key === 'which node') {
      return { code: 0, stdout: '/usr/bin/node\n', stderr: '' };
    }
    if (key === 'which npm') {
      return { code: 0, stdout: '/usr/bin/npm\n', stderr: '' };
    }
    if (key === 'which curl-crypto' && calls.filter((call) => call === 'which curl-crypto').length === 1) {
      return { code: 0, stdout: '/opt/homebrew/bin/curl-crypto\n', stderr: '' };
    }
    if (key === '/opt/homebrew/bin/curl-crypto self-test') {
      const error = new Error('no such file or directory');
      error.code = 127;
      error.stdout = '';
      error.stderr = 'no such file or directory';
      throw error;
    }
    if (key === 'npm install -g github:leeguooooo/curl-crypto-plugin') {
      return { code: 0, stdout: 'installed', stderr: '' };
    }
    if (key === 'which curl-crypto' && calls.filter((call) => call === 'which curl-crypto').length === 2) {
      return { code: 0, stdout: '/usr/local/bin/curl-crypto\n', stderr: '' };
    }
    if (key === '/usr/local/bin/curl-crypto self-test') {
      return { code: 0, stdout: '{"ok":true}\n', stderr: '' };
    }

    throw new Error(`Unexpected command: ${key}`);
  };

  const result = await ensureCurlCrypto({ exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.autoInstalled, true);
  assert.equal(result.cliPath, '/usr/local/bin/curl-crypto');
  assert.deepEqual(calls, [
    'which node',
    'which npm',
    'which curl-crypto',
    'npm prefix -g',
    '/opt/homebrew/bin/curl-crypto self-test',
    'npm install -g github:leeguooooo/curl-crypto-plugin',
    'which curl-crypto',
    'npm prefix -g',
    '/usr/local/bin/curl-crypto self-test',
  ]);
});

test('installs curl-crypto automatically when missing', async () => {
  const calls = [];
  const exec = async (command, args = []) => {
    calls.push(`${command} ${args.join(' ')}`.trim());
    const key = calls[calls.length - 1];

    if (key === 'which node') {
      return { code: 0, stdout: '/usr/bin/node\n', stderr: '' };
    }
    if (key === 'which npm') {
      return { code: 0, stdout: '/usr/bin/npm\n', stderr: '' };
    }
    if (key === 'which curl-crypto' && calls.filter((call) => call === 'which curl-crypto').length === 1) {
      const error = new Error('missing');
      error.code = 1;
      error.stdout = '';
      error.stderr = 'missing';
      throw error;
    }
    if (key === 'npm install -g github:leeguooooo/curl-crypto-plugin') {
      return { code: 0, stdout: 'installed', stderr: '' };
    }
    if (key === 'which curl-crypto' && calls.filter((call) => call === 'which curl-crypto').length === 2) {
      return { code: 0, stdout: '/usr/local/bin/curl-crypto\n', stderr: '' };
    }
    if (key === '/usr/local/bin/curl-crypto self-test') {
      return { code: 0, stdout: '{"ok":true}\n', stderr: '' };
    }

    throw new Error(`Unexpected command: ${key}`);
  };

  const result = await ensureCurlCrypto({ exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.autoInstalled, true);
  assert.deepEqual(calls, [
    'which node',
    'which npm',
    'which curl-crypto',
    'npm prefix -g',
    'npm install -g github:leeguooooo/curl-crypto-plugin',
    'which curl-crypto',
    'npm prefix -g',
    '/usr/local/bin/curl-crypto self-test',
  ]);
});

test('falls back to npm global bin when curl-crypto is not on PATH after install', async () => {
  const calls = [];
  const exec = async (command, args = []) => {
    calls.push(`${command} ${args.join(' ')}`.trim());
    const key = calls[calls.length - 1];

    if (key === 'which node') {
      return { code: 0, stdout: '/usr/bin/node\n', stderr: '' };
    }
    if (key === 'which npm') {
      return { code: 0, stdout: '/usr/bin/npm\n', stderr: '' };
    }
    if (key === 'which curl-crypto') {
      const error = new Error('missing');
      error.code = 1;
      error.stdout = '';
      error.stderr = 'missing';
      throw error;
    }
    if (key === 'npm prefix -g') {
      return { code: 0, stdout: '/Users/leo/.local/share/fnm/node-versions/v22.21.0/installation\n', stderr: '' };
    }
    if (key === '/Users/leo/.local/share/fnm/node-versions/v22.21.0/installation/bin/curl-crypto self-test') {
      return { code: 0, stdout: '{"ok":true}\n', stderr: '' };
    }
    if (key === 'npm install -g github:leeguooooo/curl-crypto-plugin') {
      return { code: 0, stdout: 'installed', stderr: '' };
    }

    throw new Error(`Unexpected command: ${key}`);
  };

  const result = await ensureCurlCrypto({ exec });

  assert.equal(result.ok, true);
  assert.equal(result.code, 'OK');
  assert.equal(result.autoInstalled, false);
  assert.equal(result.cliPath, '/Users/leo/.local/share/fnm/node-versions/v22.21.0/installation/bin/curl-crypto');
  assert.deepEqual(calls, [
    'which node',
    'which npm',
    'which curl-crypto',
    'npm prefix -g',
    '/Users/leo/.local/share/fnm/node-versions/v22.21.0/installation/bin/curl-crypto self-test',
  ]);
});
