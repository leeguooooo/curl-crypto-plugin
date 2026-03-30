import { fileURLToPath } from 'node:url';

import { setupCurlCrypto } from './run-curl-crypto.mjs';

async function main() {
  const result = await setupCurlCrypto();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
