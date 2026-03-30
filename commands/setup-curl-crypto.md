---
name: setup-curl-crypto
description: Install or verify the curl-crypto CLI and run a local self-test.
---

# Setup Curl Crypto

1. Run `command -v curl-crypto >/dev/null || npm install -g github:leeguooooo/curl-crypto-plugin`.
2. Run `curl-crypto self-test` immediately after discovery or installation. Do not use `npx curl-crypto` or `npm bin -g` as fallbacks.
3. If `curl-crypto self-test` fails because the local install is broken, reinstall with `npm install -g github:leeguooooo/curl-crypto-plugin` and run `curl-crypto self-test` again.
4. If the command returns `RUNTIME_BUNDLE_REQUIRED`, tell the user to ask Leo for `runtime.dat`.
5. Run `curl-crypto config init` if the service needs private local config.
6. If setup succeeds, summarize that curl-crypto is ready for encrypted curl and payload work.
