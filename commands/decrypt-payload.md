---
name: decrypt-payload
description: Decrypt a single encrypted payload string when the key material is already known.
---

# Decrypt Payload

1. Run `curl-crypto decrypt-payload --data '<cipher>' --key <key>`.
2. If a second key fragment is required, add `--key-suffix <value>`.
3. Return the decrypted JSON or plaintext.
