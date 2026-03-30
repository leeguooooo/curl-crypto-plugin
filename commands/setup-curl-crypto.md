---
name: setup-curl-crypto
description: Install or verify the curl-crypto CLI and run a local self-test.
---

# Setup Curl Crypto

1. Run `command -v curl-crypto >/dev/null || npm install -g github:leeguooooo/curl-crypto-plugin`.
2. Run `curl-crypto self-test`.
3. If the command returns `RUNTIME_BUNDLE_REQUIRED`, tell the user to ask Leo for `runtime.dat`.
4. Run `curl-crypto config init` if the service needs private local config.
5. If setup succeeds, summarize that curl-crypto is ready for encrypted curl and payload work.
