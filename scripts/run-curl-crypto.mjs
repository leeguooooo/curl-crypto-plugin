import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { ensureCurlCrypto } from './ensure-curl-crypto.mjs';

const execFile = promisify(execFileCallback);

function createCommandError(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

function normalizeOutput(value) {
  return typeof value === 'string' ? value.trim() : '';
}

async function defaultExec(command, args = []) {
  const result = await execFile(command, args, { encoding: 'utf8' });

  return {
    code: 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

export async function runCurlCrypto({
  args = [],
  ensureCurlCrypto: ensureCurlCryptoFn = ensureCurlCrypto,
  exec = defaultExec,
} = {}) {
  const environment = await ensureCurlCryptoFn({ exec });
  if (!environment.ok) {
    return environment;
  }

  try {
    const result = await exec('curl-crypto', args);
    return {
      ok: true,
      code: 'OK',
      stdout: normalizeOutput(result.stdout),
      stderr: normalizeOutput(result.stderr),
      autoInstalled: environment.autoInstalled,
    };
  } catch (error) {
    return createCommandError('COMMAND_FAILED', 'curl-crypto command failed.', {
      stdout: normalizeOutput(error.stdout),
      stderr: normalizeOutput(error.stderr),
      exitCode: error.code ?? 1,
    });
  }
}

export async function setupCurlCrypto({
  ensureCurlCrypto: ensureCurlCryptoFn = ensureCurlCrypto,
  exec = defaultExec,
} = {}) {
  const environment = await ensureCurlCryptoFn({ exec });
  if (!environment.ok) {
    return environment;
  }

  const selfTest = await runCurlCrypto({
    args: ['self-test'],
    ensureCurlCrypto: async () => environment,
    exec,
  });

  if (!selfTest.ok) {
    return {
      ...selfTest,
      autoInstalled: environment.autoInstalled,
    };
  }

  return {
    ok: true,
    code: 'OK',
    autoInstalled: environment.autoInstalled,
    stdout: selfTest.stdout,
    message: environment.autoInstalled
      ? 'curl-crypto was installed and passed self-test.'
      : 'curl-crypto is already installed and passed self-test.',
  };
}

async function main() {
  const result = await runCurlCrypto({ args: process.argv.slice(2) });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
