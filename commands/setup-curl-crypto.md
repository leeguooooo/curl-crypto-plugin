---
name: setup-curl-crypto
description: Install or verify the curl-crypto CLI and run a local self-test.
---

# Setup Curl Crypto

1. Run `command -v curl-crypto >/dev/null || npm install -g github:leeguooooo/curl-crypto-plugin`.
2. If `command -v curl-crypto` still fails after installation, use `CLI_PATH="$(npm prefix -g)/bin/curl-crypto"` and continue with that absolute path. Do not use `npx curl-crypto`, `npm bin -g`, or npm-registry package lookups.
3. Run `"${CLI_PATH:-curl-crypto}" doctor` immediately after discovery or installation.
4. If the self-test fails because the local install is broken, reinstall with `npm install -g github:leeguooooo/curl-crypto-plugin` and run the same self-test again. Do not delete global module folders or guess npm internals.
5. If the command returns `RUNTIME_BUNDLE_REQUIRED`, tell the user to ask Leo for `runtime.dat` and place it at `~/.config/curl-crypto/runtime.dat`.
6. Run `"${CLI_PATH:-curl-crypto}" config init` if the service needs private local config.
7. If setup succeeds, summarize that curl-crypto is ready for encrypted curl and payload work.
