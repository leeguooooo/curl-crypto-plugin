import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';

const BUNDLE_MAGIC = 'CCRB1';
const BUNDLE_XOR_KEY = createHash('sha256').update('curl-crypto-runtime-bundle').digest();

export const BUNDLED_RUNTIME_PATH = fileURLToPath(new URL('../../vendor/runtime.dat', import.meta.url));

function xorBuffer(buffer) {
  const output = Buffer.alloc(buffer.length);

  for (let index = 0; index < buffer.length; index += 1) {
    output[index] = buffer[index] ^ BUNDLE_XOR_KEY[index % BUNDLE_XOR_KEY.length];
  }

  return output;
}

function serializePayload(payload) {
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'));
  return Buffer.concat([Buffer.from(BUNDLE_MAGIC, 'utf8'), xorBuffer(compressed)]);
}

function parseBundleBuffer(buffer) {
  const magic = buffer.subarray(0, BUNDLE_MAGIC.length).toString('utf8');
  if (magic !== BUNDLE_MAGIC) {
    throw new Error('Invalid runtime bundle header.');
  }

  const compressed = xorBuffer(buffer.subarray(BUNDLE_MAGIC.length));
  return JSON.parse(gunzipSync(compressed).toString('utf8'));
}

export async function writeRuntimeBundle({
  configPath,
  wasmPath,
  outputPath = BUNDLED_RUNTIME_PATH,
} = {}) {
  const [configRaw, wasmRaw] = await Promise.all([readFile(configPath, 'utf8'), readFile(wasmPath)]);
  let configPayload = configRaw;

  try {
    const parsedConfig = JSON.parse(configRaw);
    parsedConfig.runtime = {
      ...(parsedConfig.runtime ?? {}),
      wasmBinaryPath: '',
      wasmExecPath: '',
    };
    configPayload = `${JSON.stringify(parsedConfig, null, 2)}\n`;
  } catch {
    // Keep the original config payload when it is not valid JSON.
  }

  const payload = {
    version: 1,
    files: [
      {
        name: 'config.json',
        encoding: 'utf8',
        data: configPayload,
      },
      {
        name: 'mimlib.wasm',
        encoding: 'base64',
        data: wasmRaw.toString('base64'),
      },
    ],
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializePayload(payload));

  return {
    outputPath,
    fileCount: payload.files.length,
  };
}

export async function extractRuntimeBundle({
  bundlePath = BUNDLED_RUNTIME_PATH,
  targetDir,
} = {}) {
  const buffer = await readFile(bundlePath);
  const payload = parseBundleBuffer(buffer);

  if (!Array.isArray(payload.files) || payload.files.length === 0) {
    throw new Error('Runtime bundle did not contain any files.');
  }

  await mkdir(targetDir, { recursive: true });

  const writtenFiles = [];

  for (const file of payload.files) {
    const outputPath = path.join(targetDir, file.name);
    const content =
      file.encoding === 'base64' ? Buffer.from(file.data, 'base64') : Buffer.from(String(file.data), 'utf8');

    await writeFile(outputPath, content);
    writtenFiles.push(outputPath);
  }

  return {
    bundlePath,
    targetDir,
    writtenFiles,
  };
}
