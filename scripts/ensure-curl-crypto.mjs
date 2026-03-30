import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFile = promisify(execFileCallback);
const INSTALL_TARGET = 'github:leeguooooo/curl-crypto-plugin';

function createCommandError(code, message, extra = {}) {
  return {
    ok: false,
    code,
    message,
    ...extra,
  };
}

async function defaultExec(command, args = []) {
  const result = await execFile(command, args, { encoding: 'utf8' });

  return {
    code: 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

async function findBinary(binary, exec = defaultExec) {
  const locator = process.platform === 'win32' ? 'where' : 'which';
  const result = await exec(locator, [binary]);

  return (result.stdout ?? '').trim();
}

async function verifyCli(cliPath, exec = defaultExec) {
  await exec(cliPath, ['self-test']);
}

export async function ensureCurlCrypto({ exec = defaultExec } = {}) {
  try {
    await findBinary('node', exec);
  } catch (error) {
    return createCommandError('NODE_MISSING', 'Node.js is required to run curl-crypto.', {
      stderr: error.stderr ?? '',
    });
  }

  try {
    await findBinary('npm', exec);
  } catch (error) {
    return createCommandError('NPM_MISSING', 'npm is required to install curl-crypto automatically.', {
      stderr: error.stderr ?? '',
    });
  }

  try {
    const cliPath = await findBinary('curl-crypto', exec);
    await verifyCli(cliPath, exec);
    return {
      ok: true,
      code: 'OK',
      autoInstalled: false,
      cliPath,
    };
  } catch (error) {
    if (error?.stderr || error?.stdout) {
      // Found but unusable: continue to a clean reinstall.
    }
  }

  try {
    await exec('npm', ['install', '-g', INSTALL_TARGET]);
  } catch (error) {
    return createCommandError('CLI_INSTALL_FAILED', 'Unable to install curl-crypto automatically.', {
      stderr: error.stderr ?? '',
      installTarget: INSTALL_TARGET,
    });
  }

  try {
    const cliPath = await findBinary('curl-crypto', exec);
    await verifyCli(cliPath, exec);
    return {
      ok: true,
      code: 'OK',
      autoInstalled: true,
      cliPath,
    };
  } catch (error) {
    return createCommandError('CLI_INVALID', 'curl-crypto is still unavailable after installation or cannot run self-test.', {
      stderr: error.stderr ?? '',
      stdout: error.stdout ?? '',
      installTarget: INSTALL_TARGET,
    });
  }
}

async function main() {
  const result = await ensureCurlCrypto();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
