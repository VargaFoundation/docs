---
id: configuration
title: Configuration
sidebar_position: 5
---

# Configuration

`trica server --config FILE` reads one YAML file; **unknown keys are rejected**, so a typo stops
the start instead of being ignored. Some keys can be overridden by environment variables.
`TRICA_CONFIG` names the file when `--config` is not given. With the Helm chart, the file is
built from the `config` value, plus the keys the chart sets itself (listen addresses and mounted
paths).

**No secret is ever a key of this file.** The database URL is a file reference (or
`TRICA_DATABASE_URL`), collector credentials are `file:` or `env:` references, and the OIDC
client secret does not exist (the UI is a public PKCE client).

## Core

| Key | Environment | Default | Meaning |
|---|---|---|---|
| `database.url_file` | `TRICA_DATABASE_URL` (the URL itself, takes precedence) | required | File holding the PostgreSQL URL, typically a mounted Secret. Never logged. |
| `http.addr` | `TRICA_HTTP_ADDR` | `:8080` | Listen address of the UI, the API, the MCP server and the health endpoints. |
| `http.shutdown_timeout` | | `20s` | Grace period for in-flight requests on SIGTERM. |
| `log_level` | `TRICA_LOG_LEVEL` | `info` | `debug`, `info`, `warn` or `error`. Logs are JSON on stderr. |
| `migrate_on_start` | | `true` | Apply pending migrations before serving, under an advisory lock. |
| `sweep_interval` | | `1m` | How often unseen objects are marked absent. |
| `schema_overlays` | | `[]` | YAML files with custom types, attributes and relations merged over the built-in schema. A broken overlay stops the start. |

## Reconciliation policy

| Key | Default | Meaning |
|---|---|---|
| `policy.priorities` | `[]` | Per-attribute source priorities: which source wins when several observe the same attribute. |
| `policy.propose` | `[]` | Source globs whose batches wait for a human approval, e.g. `mcp:*`, `deduce:*`, `import:*`. |
| `policy.absent_after` | `30m` | How long an observed object may go unseen before it is marked absent (never deleted). |

## Authentication, authorisation and limits

There is no anonymous mode: the API and the MCP server refuse a request without a valid bearer
credential (an API token, or an OIDC JWT when `auth.oidc` is set).

| Key | Environment | Default | Meaning |
|---|---|---|---|
| `auth.oidc.issuer` | `TRICA_OIDC_ISSUER` | none (OIDC off) | Issuer URL (`https` required). Discovery runs at start; an issuer that does not answer is retried on use (JWTs get a 503 meanwhile, API tokens keep working); a discovery document that contradicts the configuration stops the start. |
| `auth.oidc.audience` | | required with `auth.oidc` | Accepted audiences (list). |
| `auth.oidc.groups_claim` | | `groups` | Claim listing the user's groups. |
| `auth.policy_file` | | built-in `viewer` / `operator` / `admin` | RBAC policy file: roles (actions, optional type and site restrictions) and group mappings. Unknown keys rejected. |
| `auth.group_roles` | | `{}` | Group to roles, merged over the policy. A role that does not exist stops the start. |
| `auth.rate_limit.rate` / `burst` | | `20` / `60` | Requests per second and burst, per principal (per peer address before authentication), shared by the API and MCP. Over it: 429. |
| `audit.rate_limited_every` | | `1m` | A 429 is recorded in the audit log once per caller and period; the next entry counts the others. |
| `audit.anchor_interval` | | `5m` | How often each replica logs the head of the audit chain and publishes `trica_audit_head_id`; a regression is logged as an error and counted. |

## Components

| Key | Environment | Default | Meaning |
|---|---|---|---|
| `mcp.disabled` | | `false` | Leave `/mcp` unmounted. |
| `mcp.graph_refresh` | | `1m` | Upper bound on how stale the MCP dependency graph can be when a change notification was lost (normally it is rebuilt on the next graph call after any commit). |
| `mcp.disable_localhost_protection` | | `false` | Accept loopback `Host` headers behind a same-host proxy. |
| `deduce.disabled` | | `false` | Stop the cabling deducer. |
| `deduce.interval` | | `5m` | Time between deduction passes (one replica at a time); also the period of the device-type library pass. |
| `web.disabled` | | `false` | Leave the UI at `/` unmounted. |
| `web.oidc.client_id` | | none | Public OIDC client of the UI; enables "Sign in with SSO". |
| `web.oidc.issuer` | | `auth.oidc.issuer` | Issuer the browser signs in with. |
| `web.oidc.scopes` | | `openid profile email` | Scopes requested by the UI; `openid` is always added. |
| `web.oidc.bearer` | | `access_token` | Which token the UI sends: `access_token` or `id_token`. The API checks its audience. |
| `collect.targets_file` | | none (no collector runs) | Targets the server collects from on schedule, one replica at a time ([Collectors](./collectors.md)). A file that does not parse stops the start; changes need a restart. |
| `transport.addr` | `TRICA_TRANSPORT_ADDR` | none (off) | Listen address of the mutual-TLS endpoint for agents and remote collectors, on a port apart from `http.addr`. |
| `transport.ca_dir` | | required with `transport.addr` | Directory holding `ca.pem` and `ca-key.pem`, created on first start. Use a persistent volume: losing the CA un-enrols every agent. |
| `transport.hosts` | | required with `transport.addr` | Names and IPs in the server certificate: what agents dial. |
| `transport.cert_ttl` | | `168h` | Validity of agent and collector certificates (renewed automatically). |
| `transport.server_cert_ttl` | | `2160h` | Validity of the server certificate, renewed in place after two thirds of it. |

## Example

```yaml
database:
  url_file: /var/run/secrets/trica/database-url
http:
  addr: ":8080"
log_level: info
policy:
  absent_after: 30m
  propose: ["mcp:*", "deduce:*"]
schema_overlays: [/etc/trica/schema/site.yaml]
auth:
  oidc:
    issuer: https://sso.example.com/realms/example
    audience: [trica]
  group_roles:
    infra-admins: [admin]
    infra-operators: [operator]
    staff: [viewer]
web:
  oidc:
    client_id: trica-ui
collect:
  targets_file: /etc/trica/collect/targets.yaml
transport:
  addr: ":8443"
  ca_dir: /var/lib/trica/ca
  hosts: [trica-agents.example.com]
```

## Schema overlays

```yaml
# /etc/trica/schema/site.yaml
types:
  device:
    attributes:
      cost_center: {kind: string, search: true}
```

Custom attributes appear in the API (`/api/v1/schema`, the OpenAPI document), the search language
and the UI forms without a code change.

## Collector targets file

```yaml
targets:
  - kind: arista
    name: sw-a1
    address: https://192.0.2.10
    username: monitor
    password: file:/var/run/secrets/collect/arista/password
    tls: {ca_file: /etc/trica/switch-ca.pem}
    timeout: 30s
    interval: 5m
    domain: site-a
    options: {}
```

| Key | Meaning |
|---|---|
| `kind` | `arista`, `kubernetes`, `maas`, `mikrotik`, `pfsense` or `redfish`. |
| `name` | Identifies the target; the batch source is `KIND:NAME`. Unique per kind. |
| `address` | Where to connect; the form depends on the collector. |
| `username` | Account name, for the collectors that use one. |
| `password` | **A reference, never a value**: `file:/path` (trailing newline trimmed) or `env:NAME`. A literal value stops the start. |
| `tls` | `ca_file`, `insecure` (explicit, per target), `min_version`. |
| `timeout` | Bound of one run, `30s` by default. |
| `interval` | Time between runs, `5m` by default. |
| `domain` | Routing domain the target's addresses and prefixes are unique in. Empty: the global domain. Set it before the first run: changing it creates new objects. |
| `options` | Collector-specific settings ([Collectors](./collectors.md)); unknown keys are an error. |

## Remote collector configuration

`trica collector --config FILE` (or `TRICA_COLLECTOR_CONFIG`):

| Key | Meaning |
|---|---|
| `server_url` | `https://host:port` of the server's transport endpoint. |
| `server_name` | Optional: the name in the server certificate. |
| `ca_file` | The server's `ca.pem`, handed over out of band. |
| `state_dir` | Persistent directory: one certificate, key and spool per target. |
| `targets_file` | The same format as above. |
| `flush_interval` | How often spooled batches are resent (`30s`). |
| `metrics_addr` | Optional Prometheus listener (e.g. `:9102`). |
| `enrol_token_files` | Map `KIND:NAME` → file holding that target's one-time enrolment token; needed only until the target has its certificate. |

## Agent settings

`trica-agent` takes flags or environment variables (the packages read
`/etc/trica-agent/agent.env`):

| Flag | Environment | Meaning |
|---|---|---|
| `--server` | `TRICA_AGENT_SERVER` | `https://host:port` of the transport endpoint (`http://` is refused). |
| `--ca-file` | `TRICA_AGENT_CA_FILE` | CA certificate of the server; required with `--server`. No trust on first use. |
| `--enrol-token-file` | `TRICA_AGENT_ENROL_TOKEN_FILE` | File holding the one-time or class enrolment token; read only while the agent has no certificate. |
| `--domain` | `TRICA_AGENT_DOMAIN` | Routing domain of the host's addresses. |
| `--state-dir` | | Identity, spool and update state (`/var/lib/trica-agent` in the packages). |
| `--interval` / `--once` | | Time between runs (default 5 m, minimum 30 s), or one run. |
| `--output` | | `-` (stdout, default) or a file; offline use without a server. |
