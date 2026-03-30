# curl-crypto-plugin

Cursor and Claude Code plugin for encrypted request workflows.

It ships with a local `curl-crypto` CLI so AI agents can decrypt request parameters from encrypted curl commands and encrypt payloads before calling test services. Service-specific details are loaded from a private local config file instead of being committed into the repository.

## What it does

- Detect and install `curl-crypto` automatically from this GitHub repository
- Decrypt payloads from POST bodies like `{"data":"..."}`
- Decrypt GET query payloads such as `?data=...`
- Load lookup URLs, header names, and fallback key material from a local config file
- Encrypt JSON payloads so agents can call encrypted test-service endpoints

## Primary workflows

- `curl-crypto self-test`
- `curl-crypto config init`
- `curl-crypto decrypt-curl --curl-file request.curl`
- `curl-crypto decrypt-payload --data '<cipher>' --key abc --key-suffix xyz`
- `curl-crypto encrypt-payload --data '{"foo":"bar"}' --key abc --key-suffix xyz`
- `curl-crypto lookup-key --context ctx-123`

## Private configuration

Default path:

- `~/.config/curl-crypto/config.json`

Override path:

- `CURL_CRYPTO_CONFIG=/path/to/config.json`
- `curl-crypto --config /path/to/config.json ...`

Initialize interactively:

```bash
curl-crypto config init
```

## Layout

- `.cursor-plugin/plugin.json`: Cursor marketplace metadata
- `.claude-plugin/plugin.json`: Claude Code plugin metadata
- `bin/curl-crypto.mjs`: installable CLI entrypoint
- `scripts/lib/config.mjs`: private config loading and writing
- `scripts/lib/curl-parser.mjs`: shell-style curl parsing
- `scripts/lib/curl-crypto-core.mjs`: encryption, decryption, and request-param extraction

## Local development

```bash
npm test
npm run validate
npm run dev
npm run build
```
