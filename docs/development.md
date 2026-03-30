# Development

The repository is public-safe by design: service-specific lookup URLs, header names, and fallback key material are loaded from private local config instead of being committed here.

## Structure

- `bin/curl-crypto.mjs`: CLI entrypoint
- `scripts/lib/config.mjs`: private config loading, env overrides, and config writing
- `scripts/lib/curl-parser.mjs`: multi-line curl parser
- `scripts/lib/curl-crypto-core.mjs`: encryption, decryption, lookup integration, and request-param extraction
- `tests/`: install, execution, config, and crypto behavior tests

## Commands

```bash
npm test
npm run validate
npm run build
```
