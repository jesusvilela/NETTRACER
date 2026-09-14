# Security Policy

## Reporting Security Issues

If you discover a potential security vulnerability in NETTRACER, please report it privately rather than opening a public issue.

### Preferred Channel

Please email security reports to **jesusvilela@users.noreply.github.com** or report via GitHub Security Advisories if enabled on the repository.

### What to Include

- Description of the issue and potential impact
- Step-by-step instructions to reproduce
- Proof of concept or example request payload if applicable

Thank you for helping keep NETTRACER secure!

## Deployment Hardening Notes

- The broker binds to `127.0.0.1` by default. Only set `HOST=0.0.0.0` (or a LAN/public address) behind a TLS-terminating reverse proxy, and set `COOKIE_SECURE=true` so the session cookie is marked `Secure`.
- The operator session (`/api/auth/login`) is a single high-privilege account. Anyone holding a valid session or bearer token can read stored traffic/traces/packets, drive the SLANG control plane, and read/write files under `DATA_DIR` and any configured integration roots (`UTAI_ROOT`, `IGBUNDLE_ROOT`, `TOPOSTRASGO_ROOT`, `SLANG_PACK_SOURCE`). Treat the operator passkey (`data/state/operator-passkey.txt` by default) like a root credential: keep it out of logs/screenshots, and rotate it (delete the file or set `OPERATOR_PASSKEY`) if it may have leaked.
- Repository/ingress scanning endpoints (`/api/epic1/scan/preview`, `/api/ingress/scan`) intentionally allow an authenticated operator to point the scanner at arbitrary accessible paths, by design, for cross-repository ingestion. Do not run NETTRACER as a highly privileged OS user, and do not share the operator passkey with anyone who should not have broad read access to the host filesystem.
- Login attempts are throttled per source IP; failed logins beyond a short-window threshold are rejected without checking the passkey.
- The `/ws/slang` control-plane socket requires a valid session at connect time and re-validates it before every privileged (pack upgrade / multimodal filesystem) message, but subscribe/telemetry messages remain available for the life of the connection once authenticated.
