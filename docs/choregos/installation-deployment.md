---
id: installation-deployment
title: Installation and deployment
sidebar_position: 3
---

# Installation and deployment

Choregos ships as a Helm umbrella chart with four workloads (API, console, Temporal workers and an optional
MCP tools sidecar) plus dependencies that it can either **embed** or **consume**. For one machine, use
Docker Compose ([Getting started](getting-started.md)).

## Prerequisites

| | Minimum | Notes |
| :-- | :-- | :-- |
| Kubernetes | 1.24 | `spec.suspend` on Jobs is used to queue runs |
| Kubernetes, for hosted agents | 1.29 | a hosted agent runs as a native sidecar |
| Helm | 3.12 | the chart is also an OCI artifact |
| PostgreSQL | 15 | embedded single instance for a bench, an operator in production; `pgvector` is optional (knowledge index) |
| Temporal | 1.22 | embedded dev server for a bench, a cluster in production |
| An OIDC provider | | any OIDC issuer works |

Recommended in production: a model gateway (LiteLLM), a memory service (Ecphoria), Tekton for CI, Argo CD
for CD, gVisor as a `RuntimeClass` for agent sandboxes, and the `agent-sandbox` operator (the default
executor; the chart refuses to render without it).

## Install

```bash
helm upgrade --install choregos oci://ghcr.io/vargafoundation/charts/choregos \
  --version 0.25.3 --namespace choregos --create-namespace \
  -f my-values.yaml
```

Images are published under `ghcr.io/vargafoundation/choregos-{api,orchestrator,web,tools,runner}`, multi-arch
and signed. The chart's `global.imageTag` follows the chart version. Staging and production reference images
by digest.

## Embedded or external dependencies

Each dependency has an `embedded` switch. **The default is external** for all of them: a serious installation
brings its own PostgreSQL operator, Temporal cluster and gateway.

```yaml
global:
  database:
    embedded: false
    host: choregos-pg-rw.choregos-data.svc
    name: choregos
    user: choregos
    secretRef: choregos-db            # key `url`
  temporal:
    embedded: false
    address: temporal-frontend.choregos-temporal.svc:7233
  gateway:
    embedded: false
    url: http://litellm.choregos-gateway.svc:4000
    secretRef: choregos-gateway-secrets   # key `master-key`
  memory:
    embedded: false
    url: http://ecphoria.choregos-memory.svc:8432
  objectStore:                        # file artifacts: decks, spreadsheets, images
    url: s3://choregos
    endpoint: ""                      # an S3-compatible server; empty means AWS
    secretRef: ""                     # keys `access-key`, `secret-key`; read by the API only
```

`-f charts/choregos/values/local.yaml` turns everything embedded on for a self-contained single-node bench.
In `staging` and `prod` the chart **refuses to render** when an embedded dependency, `devSecrets`, `devLogin`
or `demoFakes` is on, and names the value.

## Secrets

The chart never writes production secrets; it expects them to exist (typically synchronised by External
Secrets).

| Secret | Purpose |
| :-- | :-- |
| `run-token-private-key` (ES256) | the orchestrator mints run tokens, the API verifies them: both read the same key |
| `session-secret` | signs the session cookie and sign-in handshakes; required, at least 32 bytes on a deployed instance |
| `secrets-keks` | key ring (`id:base64`) that seals connector secrets typed in the console; losing it loses every sealed value |
| `github-app-id`, `github-app-private-key`, webhook secret | the GitHub App |
| `global.oidc.secretRef` | the OIDC client secret |
| `global.gateway.secretRef` | the gateway master key |
| `global.objectStore.secretRef` | object store keys |

Generate keys with `openssl ecparam -name prime256v1 -genkey -noout` (run token) and
`openssl rand -base64 48` (session). Rotation is covered in [Operations](operations.md).

## First organisation and first token

A fresh database has no organisation and no member. The chart bootstraps both:

```yaml
global:
  bootstrap:
    org: acme
    orgName: ACME
    admins: "alice@acme.example,bob@acme.example"
```

At every start the API creates the organisation if missing and gives those people `org_admin`; it never
touches what exists. The first API token comes from the server side:

```bash
kubectl -n choregos exec deploy/choregos-api -- choregos-admin tokens create --email alice@acme.example
choregos login --api-url https://api.choregos.example --token chg_... --org acme
```

## Identity

Register a confidential client at your OIDC provider with the redirect URI
`<apiUrl>/api/v1/auth/callback` and the scopes `openid profile email groups`. Discovery is required and the
document's `issuer` must equal `global.oidc.issuer`. Sign-in uses PKCE with a signed single-use state and a
nonce, and is bound to the provider's `sub`.

Roles come from **groups**, and a group names its organisation:

| Group in the identity provider | Role |
| :-- | :-- |
| `choregos:<org>:org-admins` | `org_admin` |
| `choregos:<org>:product-owners` | `project_owner` |
| `choregos:<org>:release-captains` | `release_captain` |
| `choregos:<org>:developers` | `developer` |
| `choregos:<org>:viewers` | `viewer` |

The same claim carries an organisation's human groups (a workflow's `group: architects` matches a member
carrying `architects` or `choregos:<org>:architects`) and, from 0.26, the **audience and owner groups of
assistants**. Row-level security is fail-closed: the API must not connect to PostgreSQL as a superuser, and
refuses to start that way in `staging` and `prod`.

## Verify

```bash
kubectl -n choregos get pods
kubectl -n choregos logs deploy/choregos-api
curl -s https://<api-host>/healthz
```

The chart ships a scrape object, alerting rules and Grafana dashboards. Set `monitoring.flavour:
victoriametrics` on a VictoriaMetrics platform: a `ServiceMonitor` is an inert object there.

## Upgrades

Migrations run as a Job and are N-1 compatible: rolling back to the previous version is safe. Read the
release notes before each minor version; the repository's deployment guide has an "Upgrading to" section for
each breaking change.
