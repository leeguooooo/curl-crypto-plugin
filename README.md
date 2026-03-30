# curl-crypto-plugin

Cursor and Claude Code plugin for encrypted request workflows.

It ships with a local `curl-crypto` CLI so AI agents can decrypt request parameters from encrypted curl commands and encrypt payloads before calling test services. Service-specific details are loaded from a private local config file instead of being committed into the repository.

## What it does

- Detect and install `curl-crypto` automatically from this GitHub repository
- Decrypt payloads from POST bodies like `{"data":"..."}`
- Decrypt GET query payloads such as `?data=...`
- Load lookup URLs, header names, and fallback key material from a local config file
- Prefer a private wasm runtime when one is available locally, then fall back to generic AES logic
- Encrypt JSON payloads so agents can call encrypted test-service endpoints

## Primary workflows

- `curl-crypto self-test`
- `curl-crypto bundle pack`
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

Shareable template:

- [config.example.json](/Users/leo/github.com/curl-crypto-plugin/config.example.json)

Initialize interactively:

```bash
curl-crypto config init
```

Or copy the template into place:

```bash
mkdir -p ~/.config/curl-crypto
cp config.example.json ~/.config/curl-crypto/config.json
```

Private wasm path:

- `~/.config/curl-crypto/mimlib.wasm`
- `CURL_CRYPTO_WASM_BINARY=/path/to/mimlib.wasm`
- `curl-crypto --wasm-binary /path/to/mimlib.wasm ...`

The repository ships a generic Go `wasm_exec.js` runtime, but the business-specific `mimlib.wasm` stays on each machine.

Optional hidden runtime bundle:

- Generate: `curl-crypto bundle pack --output vendor/runtime.dat`
- Install behavior: when `~/.config/curl-crypto/config.json` or `mimlib.wasm` is missing, the CLI will auto-extract `vendor/runtime.dat` if it exists in the installed plugin package
- Missing-bundle behavior: commands such as `self-test` and `decrypt-curl` will return a structured `RUNTIME_BUNDLE_REQUIRED` error that tells the user to ask Leo for `runtime.dat`

This bundle is only light obfuscation for team distribution convenience. It is not a security boundary.

## Team usage

For normal team users, the expected flow is:

1. Install the plugin or the local `curl-crypto` CLI.
2. Run `curl-crypto self-test` or any decrypt command.
3. If the private runtime is already present, the CLI will continue normally.
4. If the private runtime is missing, the CLI will return `RUNTIME_BUNDLE_REQUIRED` and tell the user to ask Leo for `runtime.dat`.
5. After `runtime.dat` is placed in the package bundle path, the CLI will auto-extract it into `~/.config/curl-crypto/` on the next run.

For team distribution, users should not need to manually handle plain `config.json` or `mimlib.wasm` files.

For Leo or maintainers preparing the private runtime bundle:

```bash
curl-crypto bundle pack --output vendor/runtime.dat
```

That command packages the current local `config.json` and `mimlib.wasm` into a lightly obfuscated `runtime.dat` file for internal distribution.

## Marketplace sync

This repository is the source of truth for `curl-crypto-plugin`.

To enable automatic sync into `port-wind/marketplace` after each push to `main`, configure:

- `PORT_WIND_MARKETPLACE_TOKEN`: a token that can send `repository_dispatch` events to `port-wind/marketplace`

## Layout

- `.cursor-plugin/plugin.json`: Cursor marketplace metadata
- `.claude-plugin/plugin.json`: Claude Code plugin metadata
- `bin/curl-crypto.mjs`: installable CLI entrypoint
- `scripts/lib/config.mjs`: private config loading and writing
- `scripts/lib/curl-parser.mjs`: shell-style curl parsing
- `scripts/lib/curl-crypto-core.mjs`: wasm-first encryption, decryption, and request-param extraction
- `scripts/lib/runtime-bundle.mjs`: light bundle pack/extract for private runtime payloads
- `scripts/lib/wasm-runtime.mjs`: Node-side wasm loader with a minimal browser-like shim
- `vendor/wasm/wasm_exec.js`: bundled Go wasm runtime shim

## Local development

```bash
npm test
npm run validate
npm run dev
npm run build
```
