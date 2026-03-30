---
name: encrypt-payload
description: Encrypt JSON or plaintext before sending a request to an encrypted test-service endpoint.
---

# Encrypt Payload

1. Prepare the plaintext JSON or string.
2. Run `curl-crypto encrypt-payload --data '<json-or-text>' --key <key>`.
3. If the service requires a second key fragment, add `--key-suffix <value>`.
4. Use the returned ciphertext in the request body, usually as `{"data":"<cipher>"}`.
