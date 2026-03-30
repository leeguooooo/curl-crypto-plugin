#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';

import {
  decryptCurlParams,
  decryptPayload,
  encryptPayload,
  fetchKeyFromLookup,
  runSelfTest,
} from '../scripts/lib/curl-crypto-core.mjs';
import {
  loadRuntimeConfig,
  mergeRuntimeConfig,
  writeRuntimeConfig,
} from '../scripts/lib/config.mjs';

function parseArgs(argv) {
  const positionals = [];
  const options = {};
  const toCamel = (value) => value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('--')) {
      positionals.push(token);
      continue;
    }

    const flag = token.slice(2);
    if (flag.startsWith('no-')) {
      options[toCamel(flag.slice(3))] = false;
      continue;
    }

    const separator = flag.indexOf('=');
    if (separator !== -1) {
      options[toCamel(flag.slice(0, separator))] = flag.slice(separator + 1);
      continue;
    }

    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      options[toCamel(flag)] = next;
      index += 1;
    } else {
      options[toCamel(flag)] = true;
    }
  }

  return { positionals, options };
}

async function resolveInput(options, fieldName) {
  if (typeof options[fieldName] === 'string') {
    return options[fieldName];
  }

  const fileOption = `${fieldName}File`;
  if (typeof options[fileOption] === 'string') {
    return readFile(options[fileOption], 'utf8');
  }

  return '';
}

function splitCsv(value) {
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function applyCliConfigOverrides(config, options) {
  const overrideConfig = {
    lookup: {},
    payload: {},
  };

  if (typeof options.lookupUrl === 'string') {
    overrideConfig.lookup.url = options.lookupUrl;
  }
  if (typeof options.contextHeaders === 'string') {
    overrideConfig.lookup.contextHeaders = splitCsv(options.contextHeaders);
  }
  if (typeof options.clientHeaders === 'string') {
    overrideConfig.lookup.clientHeaders = splitCsv(options.clientHeaders);
  }
  if (typeof options.deviceHeaders === 'string') {
    overrideConfig.lookup.deviceHeaders = splitCsv(options.deviceHeaders);
  }
  if (typeof options.languageHeaders === 'string') {
    overrideConfig.lookup.languageHeaders = splitCsv(options.languageHeaders);
  }
  if (typeof options.defaultClient === 'string' || typeof options.defaultDevice === 'string' || typeof options.defaultLanguage === 'string') {
    overrideConfig.lookup.defaultHeaders = {
      client: typeof options.defaultClient === 'string' ? options.defaultClient : config.lookup.defaultHeaders.client,
      device: typeof options.defaultDevice === 'string' ? options.defaultDevice : config.lookup.defaultHeaders.device,
      language: typeof options.defaultLanguage === 'string' ? options.defaultLanguage : config.lookup.defaultHeaders.language,
    };
  }
  if (typeof options.derivePositions === 'string') {
    overrideConfig.lookup.derivePositions = splitCsv(options.derivePositions);
  }
  if (typeof options.keyHeaders === 'string') {
    overrideConfig.payload.keyHeaders = splitCsv(options.keyHeaders);
  }
  if (typeof options.keySuffixHeaders === 'string') {
    overrideConfig.payload.keySuffixHeaders = splitCsv(options.keySuffixHeaders);
  }
  if (typeof options.fallbackKeys === 'string') {
    overrideConfig.payload.fallbackKeys = splitCsv(options.fallbackKeys);
  }

  return mergeRuntimeConfig(config, overrideConfig);
}

async function initConfig(options, loadedConfig) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return {
      ok: false,
      code: 'TTY_REQUIRED',
      message: 'config init requires an interactive terminal. Create the config file manually or run this command in a TTY.',
      configPath: loadedConfig.configPath,
    };
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = async (label, fallback) => {
    const answer = await rl.question(`${label} [${fallback}]: `);
    return answer.trim() || fallback;
  };

  try {
    const config = loadedConfig.config;
    const nextConfig = {
      lookup: {
        url: await ask('Lookup URL (blank disables remote lookup)', config.lookup.url),
        contextHeaders: splitCsv(await ask('Context header names (comma separated)', config.lookup.contextHeaders.join(','))),
        clientHeaders: splitCsv(await ask('Client header names (comma separated)', config.lookup.clientHeaders.join(','))),
        deviceHeaders: splitCsv(await ask('Device header names (comma separated)', config.lookup.deviceHeaders.join(','))),
        languageHeaders: splitCsv(await ask('Language header names (comma separated)', config.lookup.languageHeaders.join(','))),
        defaultHeaders: {
          client: await ask('Default client header value', config.lookup.defaultHeaders.client),
          device: await ask('Default device header value', config.lookup.defaultHeaders.device),
          language: await ask('Default language header value', config.lookup.defaultHeaders.language),
        },
        derivePositions: splitCsv(await ask('Key derivation positions (zero-based, comma separated)', config.lookup.derivePositions.join(','))),
      },
      payload: {
        keyHeaders: splitCsv(await ask('Key header names (comma separated)', config.payload.keyHeaders.join(','))),
        keySuffixHeaders: splitCsv(
          await ask('Secondary key header names (comma separated)', config.payload.keySuffixHeaders.join(','))
        ),
        fallbackKeys: splitCsv(await ask('Fallback keys (comma separated, optional)', config.payload.fallbackKeys.join(','))),
      },
    };

    const saved = await writeRuntimeConfig(nextConfig, {
      configPath: typeof options.config === 'string' ? options.config : loadedConfig.configPath,
    });

    return {
      ok: true,
      code: 'OK',
      message: 'Configuration saved.',
      configPath: saved.configPath,
      config: saved.config,
    };
  } finally {
    rl.close();
  }
}

async function run() {
  const { positionals, options } = parseArgs(process.argv.slice(2));
  const command = positionals[0];
  const loadedConfig = await loadRuntimeConfig({
    configPath: typeof options.config === 'string' ? options.config : undefined,
  });
  const runtimeConfig = applyCliConfigOverrides(loadedConfig.config, options);
  let result;

  if (command === 'self-test') {
    result = runSelfTest();
  } else if (command === 'config') {
    const subcommand = positionals[1];
    if (subcommand === 'path') {
      result = {
        ok: true,
        code: 'OK',
        configPath: loadedConfig.configPath,
        exists: loadedConfig.exists,
      };
    } else if (subcommand === 'show') {
      result = {
        ok: true,
        code: 'OK',
        configPath: loadedConfig.configPath,
        exists: loadedConfig.exists,
        config: runtimeConfig,
      };
    } else if (subcommand === 'init') {
      result = await initConfig(options, loadedConfig);
    } else {
      result = {
        ok: false,
        code: 'USAGE',
        message: 'Unknown config command. Use config path, config show, or config init.',
      };
    }
  } else if (command === 'decrypt-payload') {
    const data = await resolveInput(options, 'data');
    result = decryptPayload({
      encryptedData: data,
      key: typeof options.key === 'string' ? options.key : '',
      keySuffix: typeof options.keySuffix === 'string' ? options.keySuffix : '',
      config: runtimeConfig,
    });
  } else if (command === 'encrypt-payload') {
    const data = await resolveInput(options, 'data');
    result = encryptPayload({
      data,
      key: typeof options.key === 'string' ? options.key : '',
      keySuffix: typeof options.keySuffix === 'string' ? options.keySuffix : '',
      config: runtimeConfig,
    });
  } else if (command === 'decrypt-curl') {
    const curlCommand = await resolveInput(options, 'curl');
    result = await decryptCurlParams({
      curlCommand,
      key: typeof options.key === 'string' ? options.key : '',
      keySuffix: typeof options.keySuffix === 'string' ? options.keySuffix : '',
      autoFetchKey: options.autoFetchKey !== false,
      config: runtimeConfig,
    });
  } else if (command === 'lookup-key') {
    result = await fetchKeyFromLookup({
      contextValue: typeof options.context === 'string' ? options.context : '',
      client: typeof options.client === 'string' ? options.client : runtimeConfig.lookup.defaultHeaders.client,
      device: typeof options.device === 'string' ? options.device : runtimeConfig.lookup.defaultHeaders.device,
      language: typeof options.language === 'string' ? options.language : runtimeConfig.lookup.defaultHeaders.language,
      config: runtimeConfig,
    });
  } else {
    result = {
      ok: false,
      code: 'USAGE',
      message: 'Unknown command. Use self-test, config, decrypt-payload, encrypt-payload, decrypt-curl, or lookup-key.',
    };
  }

  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

await run();
