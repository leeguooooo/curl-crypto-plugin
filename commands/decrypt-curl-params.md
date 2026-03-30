---
name: decrypt-curl-params
description: Extract and decrypt encrypted request parameters from a curl command.
---

# Decrypt Curl Params

1. Save the curl command to a temporary file if it is multi-line.
2. Run `curl-crypto decrypt-curl --curl-file <path>`.
3. If the request does not expose key material through your configured local headers, provide `--key <key>`.
4. If the request uses a second key fragment, provide `--key-suffix <value>`.
5. Return the decrypted request parameters and call out whether the key came from explicit input, configured headers, or the lookup flow.
