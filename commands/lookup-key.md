---
name: lookup-key
description: Resolve a decryption key through the private lookup flow defined in local config.
---

# Lookup Key

1. Ensure the local config file contains the lookup URL and header mapping.
2. Run `curl-crypto lookup-key --context <value>`.
3. Return the derived key only when the user explicitly needs to inspect it.
