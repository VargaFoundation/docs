---
id: security
title: Security
sidebar_position: 8
---

# Security

## No anonymous access

The REST API and the MCP server refuse every request without a valid
`Authorization: Bearer` credential; the query string is never read. Only `/healthz`, `/readyz`,
`/metrics`, the UI's static files and `/ui-config.json` (nothing secret) are open. A missing,
expired, revoked or unverifiable credential gets a 401; if the identity provider or the database
cannot be reached the answer is a 503, never a pass.

## API tokens

- Format `trica_ID_SECRET`: 256 random bits; the server stores only the SHA-256 of the secret and
  shows the full value once. The `trica_` prefix lets secret scanners spot a leaked one.
- **Scopes are a ceiling**: `read`; `write` (read and propose); `admin` (all actions). A token may
  act only if its scope **and** its owner's roles allow it; a token cannot be created with more
  than its creator holds.
- Optional restrictions: object types, sites, expiry, and a bound source (`--source arista:sw-a1`),
  so a machine's writes are attributed to what it stands for.
- `trica token list` never shows a secret or a hash; `trica token revoke --id N` takes effect on
  the next request.
- **The first token** is minted from the command line next to the server. That command
  authenticates nobody: whoever can run it holds the database URL, which already gives
  everything. Protect database access and `kubectl exec` rights accordingly.

## Single sign-on (OIDC)

Any OpenID Connect provider (Keycloak, Microsoft Entra ID, Okta, Authentik, Dex, …):

- The server verifies JWTs (`RS256` or `ES256` only) against the issuer's JWKS: exact `iss`, one
  accepted `aud`, `exp`, and `nbf`/`iat` when present, with 30 s of clock skew. Keys are refreshed
  on an unknown `kid` (rotation), at most every 30 s.
- Groups come from the `groups` claim (configurable) and map to roles with `auth.group_roles` or a
  policy file.
- The UI is a **public client** using the authorisation code flow with PKCE (S256): no client
  secret exists anywhere. Register a public client with the redirect URI
  `https://HOST/oidc/callback` and the UI's origin as an allowed web origin. The UI sends the
  access token by default (`web.oidc.bearer: id_token` to send the ID token instead); make sure the
  token sent carries the audience the server expects (with Keycloak, an audience mapper).
- The UI keeps the credential in memory and `sessionStorage` (gone with the tab), uses no cookies.

## Roles

| Role | Actions |
|---|---|
| `viewer` | `read` |
| `operator` | `read`, `propose` |
| `admin` | `read`, `propose`, `approve`, `admin` |

Custom roles in `auth.policy_file` can be restricted to object types and sites. No role, an
unknown role or an unknown action means **deny**. MCP tools and API reads are filtered by the same
rules: what a caller may not read is neither listed, counted nor named in a relation.

## Writes are attributed and reviewable

- Every change goes through the reconciliation engine. The source is taken from the credential,
  never from the request body; a person's batch is always `declared`, never `observed`.
- Sources listed in `policy.propose` (by default `mcp:*`) never write: their batches become
  **proposals** with a preview, approved or rejected by someone holding `approve`.
- Attributes with a secret-looking name (password, token, community, private key, pre-shared key,
  …) are refused on input, never returned by the API or MCP, and never exported.

## Read-only collectors

Collectors refuse, in code, to send anything but reads, and should run with read-only accounts
([Collectors](./collectors.md#accounts-per-collector)). Their credentials are never values in a
configuration: `file:/path` (a mounted secret) or `env:NAME` references, resolved at each run and
never logged. A literal password in a targets file stops the start.

## Transport (agents and remote collectors)

A separate listener with **mutual TLS** (TLS 1.3, HTTP/2). Agents enrol once with a one-time or
class token and a CSR; the server's CA signs a short-lived certificate bound to one source
(`agent:host-01`), and the server refuses any batch whose source is not that binding. Revocation
is checked on every request, fail closed. Clients trust only the CA file they were given; there is
no trust on first use. The CA private key lives in `transport.ca_dir`: protect that volume.

## Web hardening

Every UI response carries a strict Content-Security-Policy (`default-src 'none'`; scripts, styles,
images, fonts and connections from `'self'` only, plus the identity provider's origin for
`connect-src` when SSO is on; `frame-ancestors 'none'`, `form-action 'none'`, `base-uri 'none'`),
`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a
restrictive `Permissions-Policy` and same-origin opener and resource policies. The application uses
no inline script or style and no remote origin.

## Rate limiting

A token bucket per principal (per peer address before authentication), shared by the API and
MCP: `auth.rate_limit.rate` per second, `burst` at once, then 429 with `Retry-After`.
`X-Forwarded-For` is not trusted.

## Audit log

Every mutating request, every MCP tool call and every refusal (401, 403, 429) is recorded with
actor, action, target, outcome and request id. Secrets are redacted (keys and values that look
like passwords, tokens, JWTs or bearer headers); no header is stored. Entries are **hash-chained**
and the database refuses `UPDATE`, `DELETE` and `TRUNCATE` on the table. Every
`audit.anchor_interval` each replica logs the chain head (`audit chain head`, `head_id`,
`head_hash`) and publishes `trica_audit_head_id`; a truncated or rewritten tail increments
`trica_audit_head_regressions_total`. Ship the logs somewhere the database administrators cannot
edit, and alert on that counter.

## Runtime

The image is distroless, runs as uid 65532 on a read-only root filesystem with no capabilities and
the RuntimeDefault seccomp profile; the chart mounts the service account token only for the
in-cluster Kubernetes collector, and ships a NetworkPolicy by default. The database URL is a file,
never an environment variable in the chart.

## Reporting a vulnerability

Write to **security@varga.foundation** (or open a private security advisory on the repository),
never a public issue. Acknowledgement within 3 working days. While trica is at 0.x, only the latest
minor release receives security fixes.
