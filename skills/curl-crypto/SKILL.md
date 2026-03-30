---
name: curl-crypto
description: Decrypt request parameters from encrypted curl commands and encrypt payloads for encrypted test-service calls.
---

# Curl Crypto Skill

Use this skill when the user shares:

- a curl command whose request body or query contains encrypted `data`
- a ciphertext plus key material
- a request that must be re-encrypted before sending to a test environment
- a local config path that contains service-specific lookup settings

## Preferred execution path

Do not rely on plugin-relative `node scripts/...` paths from the user's workspace.

Always use the installed `curl-crypto` CLI directly:

1. Check `command -v curl-crypto`.
2. If it is missing, install or reinstall it with `npm install -g github:leeguooooo/curl-crypto-plugin`.
3. If `command -v curl-crypto` still fails after installation, set `CLI_PATH="$(npm prefix -g)/bin/curl-crypto"` and use that absolute path for every follow-up command in the same session.
4. After discovery or installation, always run `"${CLI_PATH:-curl-crypto}" self-test` before assuming the binary is usable.
5. Never use `npx curl-crypto`, `npm bin -g`, npm-registry package lookups, or ad-hoc `rm -rf` cleanup on global module folders for this CLI.
6. If the service needs private settings, run `"${CLI_PATH:-curl-crypto}" config init` once or point the CLI at a private config file.
7. Use `"${CLI_PATH:-curl-crypto}" decrypt-curl` to extract and decrypt request params from curl.
8. Use `"${CLI_PATH:-curl-crypto}" decrypt-payload` when the payload string is already isolated.
9. Use `"${CLI_PATH:-curl-crypto}" encrypt-payload` before calling encrypted test-service endpoints.

## Supported workflows

### Setup

- `curl-crypto self-test`
- `curl-crypto config path`
- `curl-crypto config init`

### Decrypt curl request params

- `curl-crypto decrypt-curl --curl-file request.curl`
- `curl-crypto decrypt-curl --curl '<curl string>' --key abc --key-suffix xyz`

### Decrypt a single payload

- `curl-crypto decrypt-payload --data '<cipher>' --key abc --key-suffix xyz`

### Encrypt a request payload

- `curl-crypto encrypt-payload --data '{"foo":"bar"}' --key abc --key-suffix xyz`

### Lookup a key

- `curl-crypto lookup-key --context ctx-123`

## Response expectations

- Return the decrypted request params, not just the raw ciphertext.
- Tell the user where the encrypted data came from: `body.data`, `body`, or `query.data`.
- When decryption fails, surface whether the problem is missing explicit key material, missing local config, or ciphertext mismatch.
