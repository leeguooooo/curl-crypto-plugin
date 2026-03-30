# Usage

## Setup

```bash
command -v curl-crypto >/dev/null || npm install -g github:leeguooooo/curl-crypto-plugin
curl-crypto doctor
curl-crypto config init
```

If `doctor` reports `RUNTIME_BUNDLE_REQUIRED`, ask Leo for `runtime.dat` and place it at:

```bash
~/.config/curl-crypto/runtime.dat
```

## Use a private config file

Default:

```bash
~/.config/curl-crypto/config.json
```

Override:

```bash
CURL_CRYPTO_CONFIG=/path/to/config.json curl-crypto config show
curl-crypto --config /path/to/config.json decrypt-curl --curl-file request.curl
```

## Decrypt request params from curl

```bash
curl-crypto decrypt-curl --curl-file request.curl
```

Optional flags:

- `--key <key>`
- `--key-suffix <value>`
- `--no-auto-fetch-key`

## Decrypt an isolated payload

```bash
curl-crypto decrypt-payload --data '<cipher>' --key abc --key-suffix xyz
```

## Encrypt a payload for a test-service request

```bash
curl-crypto encrypt-payload --data '{"foo":"bar"}' --key abc --key-suffix xyz
```

## Lookup a key

```bash
curl-crypto lookup-key --context ctx-123
```
